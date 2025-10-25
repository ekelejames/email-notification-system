const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { MongoClient } = require('mongodb');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Store recent logs in memory (last 1000)
const logs = [];
const MAX_LOGS = 1000;

// MongoDB connection
const MONGO_URL = process.env.MONGO_URL || 'mongodb://root:root@mongo:27017';
const MONGO_AUTH_SOURCE = process.env.MONGO_AUTH_SOURCE || 'root';
const DB_NAME = 'notification_logs';
const SYSTEM_DB_NAME = 'system_logs';
let mongoClient;
let logsCollection;
let systemLogsCollection;

// System logging function
async function logSystemEvent(eventType, component, message, metadata = {}) {
  if (!systemLogsCollection) return;
  
  const systemLog = {
    eventType,
    component,
    message,
    level: metadata.level || 'info',
    timestamp: new Date().toISOString(),
    metadata,
    _id: Date.now() + Math.random()
  };
  
  try {
    await systemLogsCollection.insertOne(systemLog);
  } catch (err) {
    console.error('Failed to write system log:', err.message);
  }
}

async function connectMongo() {
  try {
    console.log('Attempting MongoDB connection...');
    console.log('Connection URL:', MONGO_URL.replace(/\/\/.*@/, '//<credentials>@'));
    
    mongoClient = new MongoClient(MONGO_URL, {
      authSource: MONGO_AUTH_SOURCE,
      serverSelectionTimeoutMS: 60000, // 5 second timeout
      connectTimeoutMS: 120000, // 10 second connection timeout
    });
    
    await mongoClient.connect();
    console.log('✓ MongoDB connection established');
    
    // Test the connection
    await mongoClient.db('admin').command({ ping: 1 });
    console.log('✓ MongoDB ping successful');
    
    const db = mongoClient.db(DB_NAME);
    const systemDb = mongoClient.db(SYSTEM_DB_NAME);
    
    logsCollection = db.collection('logs');
    systemLogsCollection = systemDb.collection('system_events');
    
    // Create indexes for better query performance
    await logsCollection.createIndex({ timestamp: -1 });
    await logsCollection.createIndex({ service: 1 });
    await logsCollection.createIndex({ level: 1 });
    await logsCollection.createIndex({ timestamp: -1, service: 1, level: 1 });
    
    // Create indexes for system logs
    await systemLogsCollection.createIndex({ timestamp: -1 });
    await systemLogsCollection.createIndex({ eventType: 1 });
    await systemLogsCollection.createIndex({ component: 1 });
    await systemLogsCollection.createIndex({ timestamp: -1, eventType: 1, component: 1 });
    
    console.log('✓ MongoDB indexes created successfully');
    
    return true;
  } catch (err) {
    console.error('✗ MongoDB connection error:', err.message);
    mongoClient = null;
    logsCollection = null;
    systemLogsCollection = null;
    return false;
  }
}

// Initialize the application
async function initializeApp() {
  // First try to connect to MongoDB
  const mongoConnected = await connectMongo();
  
  // Then start the server
  const PORT = 8442;
  server.listen(PORT, () => {
    console.log(`✓ Log UI Server running on port ${PORT}`);
    console.log(`✓ View logs at http://localhost:${PORT}`);
    console.log(`✓ MongoDB: ${mongoConnected ? 'CONNECTED' : 'DISCONNECTED (using memory only)'}`);
    
    // Log server start to system logs if MongoDB is connected
    if (mongoConnected) {
      logSystemEvent('server_start', 'log_server', 'Log UI Server started successfully', { 
        port: PORT,
        mongoConnected: true
      });
    }
  });
}

// Log endpoint - receives logs from services
app.post('/api/log', async (req, res) => {
  const log = {
    ...req.body,
    id: Date.now() + Math.random(),
    receivedAt: new Date().toISOString()
  };
  
  // Add to memory (for real-time display)
  logs.unshift(log);
  if (logs.length > MAX_LOGS) {
    logs.pop();
  }
  
  // Broadcast to all connected clients
  io.emit('log', log);
  
  // Save to MongoDB asynchronously (non-blocking)
  if (logsCollection) {
    setImmediate(async () => {
      try {
        await logsCollection.insertOne({
          ...log,
          _id: log.id,
          createdAt: new Date()
        });
        
        // Log to system logs as well
        await logSystemEvent(
          'service_log_received', 
          'log_server', 
          `Log received from service: ${log.service}`,
          { 
            service: log.service, 
            level: log.level,
            logId: log.id
          }
        );
      } catch (err) {
        console.error('MongoDB insert error:', err.message);
        // Don't try to log system event if MongoDB is having issues
      }
    });
  }
  
  res.status(200).json({ success: true });
});

// Get all logs endpoint (with pagination)
app.get('/api/logs', async (req, res) => {
  const { service, level, limit = 100, skip = 0, source = 'memory' } = req.query;
  
  try {
    // Log the query to system logs
    await logSystemEvent(
      'logs_query', 
      'log_server', 
      'Logs query executed',
      { service, level, limit, skip, source }
    );
    
    // Try MongoDB first if available and requested
    if (source === 'db' && logsCollection) {
      const query = {};
      if (service) query.service = service;
      if (level) query.level = level;
      
      const dbLogs = await logsCollection
        .find(query)
        .sort({ timestamp: -1 })
        .skip(parseInt(skip))
        .limit(parseInt(limit))
        .toArray();
      
      return res.json({
        logs: dbLogs,
        source: 'database',
        total: await logsCollection.countDocuments(query)
      });
    }
    
    // Fallback to memory
    let filteredLogs = logs;
    
    if (service) {
      filteredLogs = filteredLogs.filter(log => log.service === service);
    }
    
    if (level) {
      filteredLogs = filteredLogs.filter(log => log.level === level);
    }
    
    const paginatedLogs = filteredLogs.slice(
      parseInt(skip), 
      parseInt(skip) + parseInt(limit)
    );
    
    res.json({
      logs: paginatedLogs,
      source: 'memory',
      total: filteredLogs.length
    });
  } catch (err) {
    console.error('Error fetching logs:', err);
    await logSystemEvent(
      'error', 
      'log_server', 
      'Failed to fetch logs',
      { error: err.message, service, level, limit, skip }
    );
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// Get log statistics
app.get('/api/logs/stats', async (req, res) => {
  try {
    await logSystemEvent(
      'stats_query', 
      'log_server', 
      'Statistics query executed'
    );
    
    if (logsCollection) {
      const stats = await logsCollection.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            errors: { $sum: { $cond: [{ $eq: ['$level', 'error'] }, 1, 0] } },
            warnings: { $sum: { $cond: [{ $eq: ['$level', 'warning'] }, 1, 0] } },
            success: { $sum: { $cond: [{ $eq: ['$level', 'success'] }, 1, 0] } },
            info: { $sum: { $cond: [{ $eq: ['$level', 'info'] }, 1, 0] } }
          }
        },
        {
          $project: {
            _id: 0,
            total: 1,
            errors: 1,
            warnings: 1,
            success: 1,
            info: 1
          }
        }
      ]).toArray();
      
      const serviceStats = await logsCollection.aggregate([
        {
          $group: {
            _id: '$service',
            count: { $sum: 1 }
          }
        }
      ]).toArray();
      
      return res.json({
        overall: stats[0] || { total: 0, errors: 0, warnings: 0, success: 0, info: 0 },
        byService: serviceStats.reduce((acc, s) => {
          acc[s._id] = s.count;
          return acc;
        }, {}),
        source: 'database'
      });
    }
    
    // Fallback to memory stats
    const memoryStats = {
      total: logs.length,
      errors: logs.filter(l => l.level === 'error').length,
      warnings: logs.filter(l => l.level === 'warning').length,
      success: logs.filter(l => l.level === 'success').length,
      info: logs.filter(l => l.level === 'info').length
    };
    
    const serviceStats = logs.reduce((acc, log) => {
      acc[log.service] = (acc[log.service] || 0) + 1;
      return acc;
    }, {});
    
    res.json({
      overall: memoryStats,
      byService: serviceStats,
      source: 'memory'
    });
  } catch (err) {
    console.error('Error fetching stats:', err);
    await logSystemEvent(
      'error', 
      'log_server', 
      'Failed to fetch statistics',
      { error: err.message }
    );
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Clear logs endpoint
app.delete('/api/logs', async (req, res) => {
  try {
    const logsCount = logs.length;
    logs.length = 0;
    io.emit('clear');
    
    // Clear MongoDB as well
    if (logsCollection) {
      await logsCollection.deleteMany({});
    }
    
    await logSystemEvent(
      'logs_cleared', 
      'log_server', 
      'Logs cleared manually',
      { clearedCount: logsCount }
    );
    
    res.json({ success: true, message: 'Logs cleared' });
  } catch (err) {
    console.error('Error clearing logs:', err);
    await logSystemEvent(
      'error', 
      'log_server', 
      'Failed to clear logs',
      { error: err.message }
    );
    res.status(500).json({ error: 'Failed to clear logs' });
  }
});

// WebSocket connection
io.on('connection', (socket) => {
  console.log('Client connected to log stream');
  
  // Log client connection to system logs
  logSystemEvent(
    'client_connected', 
    'websocket', 
    'Client connected to log stream',
    { socketId: socket.id }
  );
  
  // Send recent logs on connection
  socket.emit('initial-logs', logs.slice(0, 100));
  
  socket.on('disconnect', () => {
    console.log('Client disconnected from log stream');
    
    // Log client disconnection to system logs
    logSystemEvent(
      'client_disconnected', 
      'websocket', 
      'Client disconnected from log stream',
      { socketId: socket.id }
    );
  });
});

// Health check
app.get('/health', (req, res) => {
  logSystemEvent(
    'health_check', 
    'log_server', 
    'Health check executed'
  );
  
  res.json({ 
    status: 'ok', 
    logsCount: logs.length,
    mongoConnected: !!logsCollection,
    timestamp: new Date().toISOString() 
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down...');
  
  await logSystemEvent(
    'server_shutdown', 
    'log_server', 
    'Server shutting down gracefully'
  );
  
  if (mongoClient) {
    await mongoClient.close();
  }
  server.close();
  process.exit(0);
});

// Start the application
initializeApp().catch(console.error);