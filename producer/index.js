const express = require('express');
const { Kafka } = require('kafkajs');
const { Pool } = require('pg');
const cors = require('cors');
const redis = require('redis');
const Logger = require('./logger');

const logger = new Logger('producer');

const app = express();
app.use(cors());
app.use(express.json());

// PostgreSQL connection with pooling
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Max connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Redis connection for caching and rate limiting
let redisClient;
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';

async function connectRedis() {
  try {
    redisClient = redis.createClient({ url: REDIS_URL });
    redisClient.on('error', (err) => logger.error('Redis error', { error: err.message }));
    await redisClient.connect();
    await logger.success('Redis connected');
  } catch (err) {
    await logger.warning('Redis not available, continuing without cache', { error: err.message });
  }
}

connectRedis();

// Kafka setup
const kafka = new Kafka({
  clientId: 'producer-service',
  brokers: [process.env.KAFKA_BROKER],
  retry: {
    initialRetryTime: 300,
    retries: 10
  }
});

const producer = kafka.producer({
  maxInFlightRequests: 5,
  idempotent: true,
  transactionalId: 'notification-producer'
});
const admin = kafka.admin();

let producerReady = false;

async function initializeKafka() {
  try {
    await producer.connect();
    await logger.success('Kafka Producer connected');
    
    await admin.connect();
    await logger.success('Kafka Admin connected');
    
    const topics = await admin.listTopics();
    const requiredTopics = [
      { topic: 'notification-requests', numPartitions: 3, replicationFactor: 1 },
      { topic: 'notification-dlq', numPartitions: 3, replicationFactor: 1 }
    ];
    
    const topicsToCreate = requiredTopics.filter(
      t => !topics.includes(t.topic)
    );
    
    if (topicsToCreate.length > 0) {
      await admin.createTopics({
        topics: topicsToCreate
      });
      await logger.success('Created topics', { 
        topics: topicsToCreate.map(t => t.topic) 
      });
    } else {
      await logger.info('All required Kafka topics exist');
    }
    
    await admin.disconnect();
    producerReady = true;
    await logger.success('Kafka initialization complete');
  } catch (err) {
    await logger.error('Kafka initialization error', { 
      error: err.message,
      stack: err.stack 
    });
  }
}

initializeKafka();

// Rate limiting middleware
async function rateLimiter(req, res, next) {
  if (!redisClient || !redisClient.isOpen) {
    return next(); // Skip if Redis not available
  }

  const ip = req.ip || req.connection.remoteAddress;
  const key = `rate_limit:${ip}`;
  const limit = 100; // requests per minute
  const window = 60; // seconds

  try {
    const current = await redisClient.incr(key);
    
    if (current === 1) {
      await redisClient.expire(key, window);
    }
    
    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - current));
    
    if (current > limit) {
      await logger.warning('Rate limit exceeded', { ip, requests: current });
      return res.status(429).json({ 
        error: 'Too many requests',
        retryAfter: await redisClient.ttl(key)
      });
    }
    
    next();
  } catch (err) {
    // If Redis fails, allow the request
    next();
  }
}

// Apply rate limiting to API routes
app.use('/api', rateLimiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    kafkaReady: producerReady,
    redisConnected: redisClient ? redisClient.isOpen : false,
    timestamp: new Date().toISOString() 
  });
});

// Get all templates (with caching)
app.get('/api/templates', async (req, res) => {
  try {
    // Try cache first
    if (redisClient && redisClient.isOpen) {
      const cached = await redisClient.get('templates:all');
      if (cached) {
        await logger.info('Templates fetched from cache');
        return res.json(JSON.parse(cached));
      }
    }
    
    const result = await pool.query(
      'SELECT id, name, description, subject, html_content, variables, created_at, updated_at FROM templates ORDER BY created_at DESC'
    );
    
    // Cache for 5 minutes
    if (redisClient && redisClient.isOpen) {
      await redisClient.setEx('templates:all', 300, JSON.stringify(result.rows));
    }
    
    await logger.info('Templates fetched from database', { count: result.rows.length });
    res.json(result.rows);
  } catch (err) {
    await logger.error('Error fetching templates', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// Get single template (with caching)
app.get('/api/templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Try cache first
    if (redisClient && redisClient.isOpen) {
      const cached = await redisClient.get(`template:${id}`);
      if (cached) {
        await logger.info('Template fetched from cache', { template_id: id });
        return res.json(JSON.parse(cached));
      }
    }
    
    const result = await pool.query(
      'SELECT * FROM templates WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      await logger.warning('Template not found', { template_id: id });
      return res.status(404).json({ error: 'Template not found' });
    }
    
    // Cache for 5 minutes
    if (redisClient && redisClient.isOpen) {
      await redisClient.setEx(`template:${id}`, 300, JSON.stringify(result.rows[0]));
    }
    
    await logger.info('Template fetched from database', { template_id: id });
    res.json(result.rows[0]);
  } catch (err) {
    await logger.error('Error fetching template', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

// Invalidate cache helper
async function invalidateTemplateCache(templateId = null) {
  if (!redisClient || !redisClient.isOpen) return;
  
  try {
    await redisClient.del('templates:all');
    if (templateId) {
      await redisClient.del(`template:${templateId}`);
    }
  } catch (err) {
    // Silently fail
  }
}

// Create new template
app.post('/api/templates', async (req, res) => {
  try {
    const { name, description, subject, html_content, variables } = req.body;
    const result = await pool.query(
      'INSERT INTO templates (name, description, subject, html_content, variables) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, description, subject, html_content, JSON.stringify(variables || [])]
    );
    
    await invalidateTemplateCache();
    
    await logger.success('Template created', { 
      template_id: result.rows[0].id,
      template_name: name 
    });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await logger.error('Error creating template', { error: err.message });
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// Update template
app.put('/api/templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, subject, html_content, variables } = req.body;
    const result = await pool.query(
      'UPDATE templates SET name = $1, description = $2, subject = $3, html_content = $4, variables = $5 WHERE id = $6 RETURNING *',
      [name, description, subject, html_content, JSON.stringify(variables || []), id]
    );
    
    if (result.rows.length === 0) {
      await logger.warning('Template not found for update', { template_id: id });
      return res.status(404).json({ error: 'Template not found' });
    }
    
    await invalidateTemplateCache(id);
    
    await logger.success('Template updated', { 
      template_id: id,
      template_name: name 
    });
    res.json(result.rows[0]);
  } catch (err) {
    await logger.error('Error updating template', { error: err.message });
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// Delete template
app.delete('/api/templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM templates WHERE id = $1 RETURNING id', [id]);
    
    if (result.rows.length === 0) {
      await logger.warning('Template not found for deletion', { template_id: id });
      return res.status(404).json({ error: 'Template not found' });
    }
    
    await invalidateTemplateCache(id);
    
    await logger.success('Template deleted', { template_id: id });
    res.json({ message: 'Template deleted successfully' });
  } catch (err) {
    await logger.error('Error deleting template', { error: err.message });
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

// Create notification request (bulk support)
app.post('/api/notifications', async (req, res) => {
  try {
    const notifications = Array.isArray(req.body) ? req.body : [req.body];
    
    if (!producerReady) {
      await logger.error('Kafka producer not ready');
      return res.status(503).json({ error: 'Kafka producer not ready' });
    }
    
    const results = [];
    const kafkaMessages = [];
    
    for (const notification of notifications) {
      const { user_name, user_email, template_id, data } = notification;
      
      if (!template_id || !data) {
        continue; // Skip invalid entries
      }
      
      // Insert request into database
      const result = await pool.query(
        'INSERT INTO requests (user_name, user_email, template_id, data, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [user_name, user_email, template_id, JSON.stringify(data), 'pending']
      );
      
      const request = result.rows[0];
      results.push(request);
      
      kafkaMessages.push({
        key: String(request.id),
        value: JSON.stringify({
          request_id: request.id,
          user_name: request.user_name,
          user_email: request.user_email,
          template_id: request.template_id,
          data: request.data,
          timestamp: new Date().toISOString(),
          retry_count: 0,
          max_retries: 3
        })
      });
    }
    
    if (kafkaMessages.length > 0) {
      // Send in batch for better performance
      await producer.send({
        topic: 'notification-requests',
        messages: kafkaMessages
      });
      
      await logger.success('Notification requests created', { 
        count: results.length
      });
    }
    
    res.status(201).json(Array.isArray(req.body) ? results : results[0]);
  } catch (err) {
    await logger.error('Error creating notification', { 
      error: err.message,
      stack: err.stack 
    });
    res.status(500).json({ error: 'Failed to create notification request' });
  }
});

// Get all requests (with pagination)
app.get('/api/requests', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    
    const result = await pool.query(
      `SELECT r.*, t.name as template_name 
       FROM requests r 
       LEFT JOIN templates t ON r.template_id = t.id 
       ORDER BY r.created_at DESC
       LIMIT $1 OFFSET $2`,
      [parseInt(limit), parseInt(offset)]
    );
    
    await logger.info('Requests fetched', { count: result.rows.length });
    res.json(result.rows);
  } catch (err) {
    await logger.error('Error fetching requests', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// Get DLQ messages
app.get('/api/dlq', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT d.*, t.name as template_name 
       FROM dead_letter_queue d 
       LEFT JOIN templates t ON d.template_id = t.id 
       ORDER BY d.failed_at DESC 
       LIMIT 100`
    );
    await logger.info('DLQ messages fetched', { count: result.rows.length });
    res.json(result.rows);
  } catch (err) {
    await logger.error('Error fetching DLQ messages', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch DLQ messages' });
  }
});

// Get DLQ statistics
app.get('/api/dlq/stats', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        COUNT(*) as total_failed,
        COUNT(CASE WHEN retry_attempted = false THEN 1 END) as pending_retry,
        COUNT(CASE WHEN retry_attempted = true THEN 1 END) as retry_exhausted,
        MIN(failed_at) as oldest_failure,
        MAX(failed_at) as latest_failure
       FROM dead_letter_queue`
    );
    res.json(result.rows[0]);
  } catch (err) {
    await logger.error('Error fetching DLQ stats', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch DLQ statistics' });
  }
});

// Retry a DLQ message
app.post('/api/dlq/:id/retry', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!producerReady) {
      await logger.error('Kafka producer not ready for DLQ retry');
      return res.status(503).json({ error: 'Kafka producer not ready' });
    }

    const dlqResult = await pool.query(
      'SELECT * FROM dead_letter_queue WHERE id = $1',
      [id]
    );

    if (dlqResult.rows.length === 0) {
      await logger.warning('DLQ message not found', { dlq_id: id });
      return res.status(404).json({ error: 'DLQ message not found' });
    }

    const dlqMessage = dlqResult.rows[0];

    await producer.send({
      topic: 'notification-requests',
      messages: [
        {
          key: String(dlqMessage.request_id),
          value: JSON.stringify({
            request_id: dlqMessage.request_id,
            user_name: dlqMessage.user_name,
            user_email: dlqMessage.user_email,
            template_id: dlqMessage.template_id,
            data: dlqMessage.data,
            timestamp: new Date().toISOString(),
            retry_count: 0,
            max_retries: 3,
            manual_retry: true
          })
        }
      ]
    });

    await pool.query(
      'UPDATE dead_letter_queue SET retry_attempted = true WHERE id = $1',
      [id]
    );

    await logger.success('DLQ message requeued', { dlq_id: id });
    res.json({ message: 'Message requeued successfully', id });
  } catch (err) {
    await logger.error('Error retrying DLQ message', { error: err.message });
    res.status(500).json({ error: 'Failed to retry DLQ message' });
  }
});

// Delete a DLQ message
app.delete('/api/dlq/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM dead_letter_queue WHERE id = $1 RETURNING id',
      [id]
    );
    
    if (result.rows.length === 0) {
      await logger.warning('DLQ message not found for deletion', { dlq_id: id });
      return res.status(404).json({ error: 'DLQ message not found' });
    }
    
    await logger.success('DLQ message deleted', { dlq_id: id });
    res.json({ message: 'DLQ message deleted successfully' });
  } catch (err) {
    await logger.error('Error deleting DLQ message', { error: err.message });
    res.status(500).json({ error: 'Failed to delete DLQ message' });
  }
});

// Bulk retry all DLQ messages
app.post('/api/dlq/retry-all', async (req, res) => {
  try {
    if (!producerReady) {
      await logger.error('Kafka producer not ready for bulk DLQ retry');
      return res.status(503).json({ error: 'Kafka producer not ready' });
    }

    const dlqResult = await pool.query(
      'SELECT * FROM dead_letter_queue WHERE retry_attempted = false ORDER BY failed_at ASC LIMIT 50'
    );

    if (dlqResult.rows.length === 0) {
      await logger.info('No DLQ messages to retry');
      return res.json({ message: 'No messages to retry', count: 0 });
    }

    const messages = dlqResult.rows.map(msg => ({
      key: String(msg.request_id),
      value: JSON.stringify({
        request_id: msg.request_id,
        user_name: msg.user_name,
        user_email: msg.user_email,
        template_id: msg.template_id,
        data: msg.data,
        timestamp: new Date().toISOString(),
        retry_count: 0,
        max_retries: 3,
        manual_retry: true
      })
    }));

    await producer.send({
      topic: 'notification-requests',
      messages
    });

    await pool.query(
      'UPDATE dead_letter_queue SET retry_attempted = true WHERE retry_attempted = false'
    );

    await logger.success('Bulk DLQ retry completed', { count: messages.length });
    res.json({ message: 'Messages requeued successfully', count: messages.length });
  } catch (err) {
    await logger.error('Error bulk retrying DLQ messages', { 
      error: err.message,
      stack: err.stack 
    });
    res.status(500).json({ error: 'Failed to bulk retry DLQ messages' });
  }
});

const PORT = 3001;
app.listen(PORT, async () => {
  await logger.success(`Producer service running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await logger.info('Shutting down producer service');
  if (redisClient && redisClient.isOpen) {
    await redisClient.quit();
  }
  await producer.disconnect();
  await pool.end();
  process.exit(0);
});