const { Kafka } = require('kafkajs');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');

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
  
  console.log(`\n📧 Processing notification for request ID: ${request_id}`);

  try {
    // Get template from database
    const templateResult = await pool.query(
      'SELECT * FROM templates WHERE id = $1',
      [template_id]
    );

    if (templateResult.rows.length === 0) {
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

    console.log(`  ✓ Template loaded: ${template.name}`);
    console.log(`  ✓ Sending to: ${user_email}`);

    // Send email
    const info = await transporter.sendMail({
      from: `"Notification System" <${process.env.SMTP_USER}>`,
      to: user_email,
      subject: subject,
      html: htmlContent,
    });

    console.log(`  ✓ Email sent successfully: ${info.messageId}`);

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

    console.log(`  ✓ Request ${request_id} marked as sent\n`);

  } catch (error) {
    console.error(`  ✗ Error processing notification:`, error.message);

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
    console.log('✓ Kafka Consumer connected');

    await consumer.subscribe({ 
      topic: 'notification-requests', 
      fromBeginning: false 
    });

    console.log('✓ Subscribed to notification-requests topic');
    console.log('✓ Consumer is ready to process messages...\n');

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const value = JSON.parse(message.value.toString());
          await processNotification(value);
        } catch (error) {
          console.error('Error in message handler:', error);
        }
      },
    });

  } catch (error) {
    console.error('Fatal error in consumer:', error);
    process.exit(1);
  }
}

// Graceful shutdown
const shutdown = async () => {
  console.log('\nShutting down consumer...');
  await consumer.disconnect();
  await pool.end();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start the consumer
run().catch(console.error);