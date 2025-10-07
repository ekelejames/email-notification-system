const express = require('express');
const { Kafka } = require('kafkajs');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Kafka setup
const kafka = new Kafka({
  clientId: 'producer-service',
  brokers: [process.env.KAFKA_BROKER],
  retry: {
    initialRetryTime: 300,
    retries: 10
  }
});

const producer = kafka.producer();

// Connect to Kafka
let producerReady = false;
producer.connect()
  .then(() => {
    console.log('✓ Kafka Producer connected');
    producerReady = true;
  })
  .catch(err => console.error('✗ Kafka Producer connection error:', err));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    kafkaReady: producerReady,
    timestamp: new Date().toISOString() 
  });
});

// Get all templates
app.get('/api/templates', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, description, subject, html_content, variables, created_at, updated_at FROM templates ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching templates:', err);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// Get single template
app.get('/api/templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM templates WHERE id = $1',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching template:', err);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

// Create new template
app.post('/api/templates', async (req, res) => {
  try {
    const { name, description, subject, html_content, variables } = req.body;
    const result = await pool.query(
      'INSERT INTO templates (name, description, subject, html_content, variables) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, description, subject, html_content, JSON.stringify(variables || [])]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating template:', err);
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
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating template:', err);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// Delete template
app.delete('/api/templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM templates WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json({ message: 'Template deleted successfully' });
  } catch (err) {
    console.error('Error deleting template:', err);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

// Create notification request
app.post('/api/notifications', async (req, res) => {
  try {
    const { user_name, user_email, template_id, data } = req.body;

    if (!producerReady) {
      return res.status(503).json({ error: 'Kafka producer not ready' });
    }

    // Insert request into database
    const result = await pool.query(
      'INSERT INTO requests (user_name, user_email, template_id, data) VALUES ($1, $2, $3, $4) RETURNING *',
      [user_name, user_email, template_id, JSON.stringify(data)]
    );

    const request = result.rows[0];

    // Send message to Kafka
    await producer.send({
      topic: 'notification-requests',
      messages: [
        {
          key: String(request.id),
          value: JSON.stringify({
            request_id: request.id,
            user_name: request.user_name,
            user_email: request.user_email,
            template_id: request.template_id,
            data: request.data,
            timestamp: new Date().toISOString()
          })
        }
      ]
    });

    console.log(`✓ Notification request created: ID=${request.id}, Template=${template_id}`);
    res.status(201).json(request);
  } catch (err) {
    console.error('Error creating notification:', err);
    res.status(500).json({ error: 'Failed to create notification request' });
  }
});

// Get all requests
app.get('/api/requests', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*, t.name as template_name 
       FROM requests r 
       LEFT JOIN templates t ON r.template_id = t.id 
       ORDER BY r.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching requests:', err);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`✓ Producer service running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await producer.disconnect();
  await pool.end();
  process.exit(0);
});