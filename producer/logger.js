// logger.js - Add this file to producer, consumer, and frontend services
const LOG_SERVER = process.env.LOG_SERVER || 'http://logui:8442';

class Logger {
  constructor(serviceName) {
    this.serviceName = serviceName;
  }

  async sendLog(level, message, details = null) {
    const log = {
      service: this.serviceName,
      level,
      message,
      details,
      timestamp: new Date().toISOString()
    };

    // Log to console
    const emoji = {
      info: 'ℹ️',
      success: '✓',
      warning: '⚠️',
      error: '✗'
    };
    
    console.log(`${emoji[level] || '•'} [${this.serviceName}] ${message}`);
    if (details) {
      console.log('  Details:', details);
    }

    // Send to log server (non-blocking)
    this.sendToLogServer(log);
  }

  sendToLogServer(log) {
    // Use setTimeout to make it truly non-blocking
    setTimeout(async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);

        await fetch(`${LOG_SERVER}/api/log`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(log),
          signal: controller.signal
        });

        clearTimeout(timeout);
      } catch (err) {
        // Silently fail - logging should not break the app
      }
    }, 0);
  }

  info(message, details) {
    return this.sendLog('info', message, details);
  }

  success(message, details) {
    return this.sendLog('success', message, details);
  }

  warning(message, details) {
    return this.sendLog('warning', message, details);
  }

  error(message, details) {
    return this.sendLog('error', message, details);
  }
}

module.exports = Logger;