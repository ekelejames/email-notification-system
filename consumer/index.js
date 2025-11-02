const Logger = require('./logger');

// Add this at the very top of consumer/index.js
require('dotenv').config();

const { Kafka } = require('kafkajs');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');

const logger = new Logger('consumer');

// connecting to PostgreSQL 
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// setting up kafka - UPDATED CONFIGURATION
const kafka = new Kafka({
  clientId: 'consumer-service',
  brokers: [process.env.KAFKA_BROKER || 'kafka:29092'],
  retry: {
    initialRetryTime: 300,
    retries: 10
  },
  connectionTimeout: 10000,
  requestTimeout: 30000
});

const consumer = kafka.consumer({ groupId: 'notification-group' });

// Email transporter - UPDATED FOR PORT 465
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT) || 465,
  secure: true, // true for port 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false
  },
  socketTimeout: 30000,
  connectionTimeout: 30000,
  greetingTimeout: 30000
});

// Verify SMTP connection on startup - ENHANCED VERSION
async function verifySmtp() {
  try {
    console.log('Testing SMTP connection with port:', process.env.SMTP_PORT);
    
    // Test with current configuration
    await transporter.verify();
    await logger.success('SMTP connection verified successfully');
    return true;
  } catch (error) {
    await logger.error('SMTP connection verification failed', { 
      error: error.message,
      code: error.code,
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      user: process.env.SMTP_USER
    });
    
    // Try alternative configuration if primary fails
    await logger.info('Trying alternative SMTP configuration...');
    try {
      const altTransporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        tls: {
          rejectUnauthorized: false
        }
      });
      
      await altTransporter.verify();
      await logger.success('SMTP connection verified with alternative configuration (port 587)');
      return true;
    } catch (altError) {
      await logger.error('Alternative SMTP configuration also failed', {
        error: altError.message
      });
      return false;
    }
  }
}

// Template variable replacement function
function replaceVariables(template, data) {
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, value || '');
  }
  return result;
}

// Move failed message to Dead Letter Queue
async function moveToDLQ(message, error) {
  const { request_id, user_name, user_email, template_id, data } = message;
  
  try {
    await pool.query(
      `INSERT INTO dead_letter_queue 
       (request_id, user_name, user_email, template_id, data, error_message, retry_count) 
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        request_id,
        user_name,
        user_email,
        template_id,
        JSON.stringify(data),
        error.message,
        message.retry_count || 0
      ]
    );
    
    await logger.warning('Message moved to DLQ', { 
      request_id,
      error: error.message 
    });
  } catch (dlqError) {
    await logger.error('Failed to move message to DLQ', { 
      request_id,
      error: dlqError.message 
    });
  }
}

// Process notification
async function processNotification(message) {
  const { request_id, user_name, user_email, template_id, data, retry_count = 0, max_retries = 3 } = message;
  
  await logger.info(`Processing notification for request ID: ${request_id}`, { 
    request_id, 
    user_email, 
    template_id,
    retry_count 
  });

  try {
    // Get template from database
    const templateResult = await pool.query(
      'SELECT * FROM templates WHERE id = $1',
      [template_id]
    );

    if (templateResult.rows.length === 0) {
      await logger.error(`Template not found`, { template_id, request_id });
      throw new Error(`Template with ID ${template_id} not found`);
    }

    const template = templateResult.rows[0];

    // Merge user data with template variables
    const emailData = {
      user_name,
      user_email,
      ...data
    };

    // Replace variables in HTML content and subject
    const htmlContent = replaceVariables(template.html_content, emailData);
    const subject = replaceVariables(template.subject, emailData);

    await logger.info(`Template loaded: ${template.name}`, { 
      template_name: template.name,
      recipient: user_email 
    });

    // Send email
    const info = await transporter.sendMail({
      from: `"Notification System" <${process.env.SMTP_USER}>`,
      to: user_email,
      subject: subject,
      html: htmlContent,
    });

    await logger.success(`Email sent successfully`, { 
      request_id,
      message_id: info.messageId,
      recipient: user_email,
      subject 
    });

    // Update request status
    await pool.query(
      'UPDATE requests SET status = $1, processed_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['sent', request_id]
    );

    // Log success
    await pool.query(
      'INSERT INTO notification_logs (request_id, status) VALUES ($1, $2)',
      [request_id, 'success']
    );

    await logger.success(`Request marked as sent`, { request_id });

  } catch (error) {
    await logger.error(`Error processing notification`, { 
      request_id,
      error: error.message,
      stack: error.stack,
      retry_count 
    });

    // Update request status to failed
    await pool.query(
      'UPDATE requests SET status = $1 WHERE id = $2',
      ['failed', request_id]
    );

    // Log error
    await pool.query(
      'INSERT INTO notification_logs (request_id, status, error_message) VALUES ($1, $2, $3)',
      [request_id, 'failed', error.message]
    );

    // Move to DLQ if max retries reached
    if (retry_count >= max_retries) {
      await logger.warning(`Max retries reached, moving to DLQ`, { 
        request_id,
        retry_count 
      });
      await moveToDLQ(message, error);
    } else {
      await logger.info(`Will retry message`, { 
        request_id,
        retry_count: retry_count + 1,
        max_retries 
      });
    }

    throw error;
  }
}

// Start consumer
async function run() {
  try {
    // Verify SMTP connection before starting
    const smtpReady = await verifySmtp();
    if (!smtpReady) {
      await logger.warning('SMTP not ready, but continuing to start consumer...');
    }

    await consumer.connect();
    await logger.success('Kafka Consumer connected');

    await consumer.subscribe({ 
      topic: 'notification-requests', 
      fromBeginning: false 
    });

    await logger.success('Subscribed to notification-requests topic');
    await logger.info('Consumer is ready to process messages');

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const value = JSON.parse(message.value.toString());
          await processNotification(value);
        } catch (error) {
          await logger.error('Error in message handler', { 
            error: error.message,
            topic,
            partition 
          });
          // Don't throw here - let Kafka commit the offset
          // The message is already in DLQ if max retries reached
        }
      },
    });

  } catch (error) {
    await logger.error('Fatal error in consumer', { 
      error: error.message,
      stack: error.stack 
    });
    process.exit(1);
  }
}

// Graceful shutdown
const shutdown = async () => {
  await logger.info('Shutting down consumer...');
  await consumer.disconnect();
  await pool.end();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start the consumer
logger.info('Starting consumer service...');
run().catch(console.error);