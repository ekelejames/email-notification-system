const { Kafka } = require('kafkajs');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');
const Logger = require('./logger');

const logger = new Logger('consumer');

// connecting to PostgreSQL 
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// setting up kafka
const kafka = new Kafka({
  clientId: 'consumer-service',
  brokers: [process.env.KAFKA_BROKER],
  retry: {
    initialRetryTime: 300,
    retries: 10
  }
});

const consumer = kafka.consumer({ groupId: 'notification-group' });

// Email transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false
  }
});

// Template variable replacement function
function replaceVariables(template, data) {
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, value || '');
  }
  return result;
}

// Process notification
async function processNotification(message) {
  const { request_id, user_name, user_email, template_id, data } = message;
  
  await logger.info(`Processing notification for request ID: ${request_id}`, { 
    request_id, 
    user_email, 
    template_id 
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
      stack: error.stack 
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

    throw error;
  }
}

// Start consumer
async function run() {
  try {
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