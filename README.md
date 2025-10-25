# 📧 Email Notification System

A scalable, event-driven email notification system built with Node.js, Kafka, PostgreSQL, Redis, and MongoDB. This system provides a complete solution for managing email templates, queuing notifications, and monitoring system logs in real-time.

## 🏗️ System Architecture
```
┌─────────────────────────────────────────────────────────────────────────┐
│                         EMAIL NOTIFICATION SYSTEM                        │
└─────────────────────────────────────────────────────────────────────────┘

                              ┌─────────────────┐
                              │   Frontend UI   │
                              │ Template Editor │
                              │  (Port: 3000)   │
                              └────────┬────────┘
                                       │
                                       │ HTTP REST API
                                       │
                              ┌────────▼────────┐
                              │  Producer API   │
                              │   Service       │
                              │  (Port: 3001)   │
                              └────────┬────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    │                  │                  │
           ┌────────▼────────┐ ┌──────▼──────┐  ┌───────▼────────┐
           │   PostgreSQL    │ │    Redis    │  │     Kafka      │
           │   Database      │ │   Cache &   │  │  Message Broker│
           │  (Port: 5432)   │ │Rate Limiting│  │  (Port: 9092)  │
           │                 │ │(Port: 6379) │  │                │
           │ • Templates     │ └─────────────┘  └───────┬────────┘
           │ • Requests      │                          │
           │ • Logs          │                          │
           │ • DLQ           │         ┌────────────────┴─────────┐
           └─────────────────┘         │                          │
                                       │                          │
                              ┌────────▼────────┐       ┌─────────▼────────┐
                              │   Consumer 1    │       │   Consumer 2     │
                              │   Service       │       │   Service        │
                              │                 │       │                  │
                              │ • Process Queue │       │ • Process Queue  │
                              │ • Send Emails   │       │ • Send Emails    │
                              │ • Handle Retry  │       │ • Handle Retry   │
                              └────────┬────────┘       └─────────┬────────┘
                                       │                          │
                                       └──────────┬───────────────┘
                                                  │
                                         ┌────────▼────────┐
                                         │  SMTP Server    │
                                         │  (Email Send)   │
                                         │                 │
                                         │ Gmail/SendGrid  │
                                         └─────────────────┘


┌─────────────────────────────────────────────────────────────────────────┐
│                     MONITORING & LOGGING LAYER                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐         ┌──────────────┐         ┌──────────────┐   │
│  │  Log UI      │◄────────│   MongoDB    │◄────────│Mongo Express │   │
│  │  Server      │         │   Storage    │         │   Admin UI   │   │
│  │ (Port: 8442) │         │ (Port:27017) │         │ (Port: 8084) │   │
│  │              │         │              │         │              │   │
│  │ • Real-time  │         │ • System Logs│         │ • DB Browser │   │
│  │ • WebSocket  │         │ • Event Logs │         │ • Query Tool │   │
│  │ • Filtering  │         │ • Metrics    │         │              │   │
│  └──────────────┘         └──────────────┘         └──────────────┘   │
│         ▲                                                               │
│         │                                                               │
│         └───────────────── All Services Log Here ─────────────────────│
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘


                    ┌──────────────────────────────┐
                    │   MESSAGE FLOW DIAGRAM       │
                    └──────────────────────────────┘

    User → Frontend → Producer → Kafka → Consumer → SMTP → Recipient
      │        │         │         │         │         │
      │        │         ├─→ PostgreSQL      │         └─→ ✉️ Email Sent
      │        │         │    (Save Request) │
      │        │         │                   │
      │        │         ├─→ Redis           └─→ Success: Update DB
      │        │         │    (Cache/Limit)       Failure: → DLQ
      │        │         │
      │        │         └─→ Log Service (All Events)
      │        │
      │        └─→ View Templates & Status
      │
      └─→ Monitor Logs (Real-time)
```

## ✨ Features

- 📝 **Visual Template Editor** - Create and manage email templates with a WYSIWYG editor
- 🚀 **Asynchronous Processing** - Kafka-based message queue for reliable notification delivery
- 💾 **Template Caching** - Redis caching for improved performance
- 🔄 **Dead Letter Queue** - Automatic retry mechanism for failed notifications
- 📊 **Real-time Monitoring** - Live log streaming with MongoDB persistence
- ⚡ **Rate Limiting** - Redis-based rate limiting to prevent abuse
- 🎯 **Variable Substitution** - Dynamic content with template variables
- 🔌 **Scalable Architecture** - Horizontally scalable consumer services

## 🛠️ Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | HTML, CSS, JavaScript, CKEditor |
| Backend | Node.js, Express |
| Message Broker | Apache Kafka |
| Databases | PostgreSQL, MongoDB |
| Cache | Redis |
| Email | Nodemailer (SMTP) |
| Container | Docker, Docker Compose |

## 📋 Prerequisites

- Docker & Docker Compose
- SMTP credentials (Gmail, SendGrid, etc.)
- Node.js 18+ (for local development)

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone <repository-url>
cd email-notification-system
```

### 2. Configure Environment Variables

Create a `.env` file in the root directory:
```env
# SMTP Configuration (Required)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Database Configuration (Optional - uses defaults)
POSTGRES_USER=admin
POSTGRES_PASSWORD=admin
POSTGRES_DB=notificationdb

# Redis Configuration (Optional)
REDIS_URL=redis://redis:6379

# MongoDB Configuration (Optional)
MONGO_URL=mongodb://root:root@mongo:27017
MONGO_AUTH_SOURCE=admin
```

### 3. Start the System
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Check service status
docker-compose ps
```

### 4. Access the Applications

| Service | URL | Description |
|---------|-----|-------------|
| 📝 Template Editor | http://localhost:3000 | Create and manage email templates |
| 🔌 Producer API | http://localhost:3001 | REST API for notifications |
| 📊 Log UI | http://localhost:8442 | Real-time log monitoring |
| 🗄️ Mongo Express | http://localhost:8084 | MongoDB admin interface |

**Mongo Express Login:**
- Username: `admin`
- Password: `admin_pass`

---

## 📱 Browser URLs (Direct Access)

Once your system is running, open these URLs directly in your browser:

| Service | Full URL | Purpose |
|---------|----------|---------|
| 📝 **Template Editor** | **http://localhost:3000** | Main UI to create and manage email templates |
| 📊 **Log Viewer** | **http://localhost:8442** | Real-time system logs and monitoring |
| 🗄️ **Database Admin** | **http://localhost:8084** | MongoDB admin interface (login: admin/admin_pass) |

---

## 🎯 Complete API Endpoints Reference

Base URL: `http://localhost:3001`

### 📧 Template Management

#### 1. Get All Templates
```bash
curl http://localhost:3001/api/templates
```

**Response:**
```json
[
  {
    "id": 1,
    "name": "welcome_email",
    "description": "Welcome email for new users",
    "subject": "Welcome to Our Platform, {{user_name}}!",
    "html_content": "<html>...</html>",
    "variables": ["user_name", "user_email"],
    "created_at": "2025-10-25T10:00:00Z",
    "updated_at": "2025-10-25T10:00:00Z"
  }
]
```

#### 2. Get Specific Template
```bash
# Replace {id} with actual template ID (e.g., 1, 2, 3)
curl http://localhost:3001/api/templates/1
```

**Response:**
```json
{
  "id": 1,
  "name": "welcome_email",
  "description": "Welcome email for new users",
  "subject": "Welcome {{user_name}}!",
  "html_content": "<html>...</html>",
  "variables": ["user_name", "user_email"]
}
```

#### 3. Create New Template
```bash
curl -X POST http://localhost:3001/api/templates \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test_email",
    "description": "My test email template",
    "subject": "Hello {{user_name}}!",
    "html_content": "<html><body><h1>Hello {{user_name}}</h1><p>Your email is {{user_email}}</p></body></html>",
    "variables": ["user_name", "user_email"]
  }'
```

#### 4. Update Template
```bash
# Replace {id} with actual template ID
curl -X PUT http://localhost:3001/api/templates/1 \
  -H "Content-Type: application/json" \
  -d '{
    "name": "updated_email",
    "description": "Updated description",
    "subject": "Updated subject {{user_name}}",
    "html_content": "<html><body><h1>Updated</h1></body></html>",
    "variables": ["user_name"]
  }'
```

#### 5. Delete Template
```bash
# Replace {id} with actual template ID
curl -X DELETE http://localhost:3001/api/templates/1
```

---

### 📨 Send Notifications

#### 6. Send Single Email
```bash
curl -X POST http://localhost:3001/api/notifications \
  -H "Content-Type: application/json" \
  -d '{
    "user_name": "John Doe",
    "user_email": "john.doe@example.com",
    "template_id": 1,
    "data": {
      "registration_date": "2025-10-25",
      "dashboard_url": "https://example.com/dashboard"
    }
  }'
```

**Response:**
```json
{
  "id": 1,
  "user_name": "John Doe",
  "user_email": "john.doe@example.com",
  "template_id": 1,
  "data": {
    "registration_date": "2025-10-25",
    "dashboard_url": "https://example.com/dashboard"
  },
  "status": "pending",
  "created_at": "2025-10-25T10:00:00Z"
}
```

#### 7. Send Bulk Emails (Multiple Recipients)
```bash
curl -X POST http://localhost:3001/api/notifications \
  -H "Content-Type: application/json" \
  -d '[
    {
      "user_name": "John Doe",
      "user_email": "john@example.com",
      "template_id": 1,
      "data": {"order_id": "12345"}
    },
    {
      "user_name": "Jane Smith",
      "user_email": "jane@example.com",
      "template_id": 1,
      "data": {"order_id": "12346"}
    }
  ]'
```

---

### 📋 Check Status & History

#### 8. Get All Notification Requests
```bash
curl http://localhost:3001/api/requests
```

**Response:**
```json
[
  {
    "id": 1,
    "user_name": "John Doe",
    "user_email": "john@example.com",
    "template_id": 1,
    "template_name": "welcome_email",
    "data": {"registration_date": "2025-10-25"},
    "status": "sent",
    "created_at": "2025-10-25T10:00:00Z",
    "processed_at": "2025-10-25T10:00:05Z"
  }
]
```

#### 9. Get Requests with Pagination
```bash
# Get 10 requests, skip first 20
curl "http://localhost:3001/api/requests?limit=10&offset=20"
```

---

### 🔄 Dead Letter Queue (Failed Emails)

#### 10. View Failed Notifications
```bash
curl http://localhost:3001/api/dlq
```

**Response:**
```json
[
  {
    "id": 1,
    "request_id": 123,
    "user_name": "John Doe",
    "user_email": "john@example.com",
    "template_id": 1,
    "error_message": "SMTP connection failed",
    "retry_count": 3,
    "retry_attempted": false,
    "failed_at": "2025-10-25T10:00:00Z"
  }
]
```

#### 11. Get DLQ Statistics
```bash
curl http://localhost:3001/api/dlq/stats
```

**Response:**
```json
{
  "total_failed": 10,
  "pending_retry": 5,
  "retry_exhausted": 5,
  "oldest_failure": "2025-10-20T10:00:00Z",
  "latest_failure": "2025-10-25T10:00:00Z"
}
```

#### 12. Retry Single Failed Email
```bash
# Replace {id} with DLQ message ID
curl -X POST http://localhost:3001/api/dlq/1/retry
```

#### 13. Retry ALL Failed Emails
```bash
curl -X POST http://localhost:3001/api/dlq/retry-all
```

**Response:**
```json
{
  "message": "Messages requeued successfully",
  "count": 50
}
```

#### 14. Delete Failed Email from Queue
```bash
# Replace {id} with DLQ message ID
curl -X DELETE http://localhost:3001/api/dlq/1
```

---

### 📊 Logs & Monitoring

#### 15. Get All Logs
```bash
curl http://localhost:8442/api/logs
```

**Response:**
```json
{
  "logs": [
    {
      "id": 1,
      "service": "consumer",
      "level": "success",
      "message": "Email sent successfully",
      "details": {
        "request_id": 123,
        "recipient": "john@example.com"
      },
      "timestamp": "2025-10-25T10:00:00Z"
    }
  ],
  "source": "memory",
  "total": 100
}
```

#### 16. Get Logs with Filters
```bash
# Filter by service
curl "http://localhost:8442/api/logs?service=consumer&limit=50"

# Filter by error level
curl "http://localhost:8442/api/logs?level=error&limit=100"

# Get from database instead of memory
curl "http://localhost:8442/api/logs?source=db&limit=100"

# Combined filters
curl "http://localhost:8442/api/logs?service=producer&level=error&limit=20&skip=0"
```

#### 17. Get Log Statistics
```bash
curl http://localhost:8442/api/logs/stats
```

**Response:**
```json
{
  "overall": {
    "total": 1000,
    "errors": 10,
    "warnings": 50,
    "success": 900,
    "info": 40
  },
  "byService": {
    "producer": 400,
    "consumer": 500,
    "log_server": 100
  },
  "source": "database"
}
```

#### 18. Clear All Logs
```bash
curl -X DELETE http://localhost:8442/api/logs
```

---

### 🏥 Health Checks

#### 19. Producer Service Health
```bash
curl http://localhost:3001/health
```

**Response:**
```json
{
  "status": "ok",
  "kafkaReady": true,
  "redisConnected": true,
  "timestamp": "2025-10-25T10:00:00Z"
}
```

#### 20. Log Service Health
```bash
curl http://localhost:8442/health
```

**Response:**
```json
{
  "status": "ok",
  "logsCount": 1000,
  "mongoConnected": true,
  "timestamp": "2025-10-25T10:00:00Z"
}
```

---

## 🧪 Complete Testing Workflow

### Step 1: Start the System
```bash
docker-compose up -d
```

### Step 2: Wait for Services (30-60 seconds)
```bash
# Check if all services are running
docker-compose ps

# All services should show "Up" status
```

### Step 3: View Pre-loaded Templates (Browser)
Open in browser: **http://localhost:3000**

You should see 2 pre-loaded templates:
- welcome_email
- order_confirmation

### Step 4: Or Get Templates via API
```bash
curl http://localhost:3001/api/templates
```

### Step 5: Send a Test Email (Replace with YOUR email)
```bash
curl -X POST http://localhost:3001/api/notifications \
  -H "Content-Type: application/json" \
  -d '{
    "user_name": "Test User",
    "user_email": "YOUR_EMAIL@gmail.com",
    "template_id": 1,
    "data": {
      "registration_date": "2025-10-25",
      "dashboard_url": "https://example.com/dashboard"
    }
  }'
```

### Step 6: Monitor Progress (Browser)
Open in browser: **http://localhost:8442**

You should see logs like:
- ✓ Processing notification for request ID: 1
- ✓ Template loaded: welcome_email
- ✓ Email sent successfully

### Step 7: Check Request Status
```bash
curl http://localhost:3001/api/requests
```

Look for `"status": "sent"` in the response.

### Step 8: Check Your Email Inbox! 📬

---

## 🎨 Using Postman Instead of cURL

### Import These Requests:

**Base URL:** `http://localhost:3001`

#### Collection: Email Notification System

1. **GET** - Get All Templates
   - URL: `http://localhost:3001/api/templates`
   - Method: GET

2. **GET** - Get Single Template
   - URL: `http://localhost:3001/api/templates/1`
   - Method: GET

3. **POST** - Create Template
   - URL: `http://localhost:3001/api/templates`
   - Method: POST
   - Headers: `Content-Type: application/json`
   - Body (raw JSON):
```json
   {
     "name": "test_email",
     "description": "Test template",
     "subject": "Hello {{user_name}}",
     "html_content": "<html><body><h1>Hello {{user_name}}</h1></body></html>",
     "variables": ["user_name", "user_email"]
   }
```

4. **POST** - Send Notification
   - URL: `http://localhost:3001/api/notifications`
   - Method: POST
   - Headers: `Content-Type: application/json`
   - Body (raw JSON):
```json
   {
     "user_name": "John Doe",
     "user_email": "your-email@gmail.com",
     "template_id": 1,
     "data": {
       "registration_date": "2025-10-25",
       "dashboard_url": "https://example.com"
     }
   }
```

5. **GET** - Get All Requests
   - URL: `http://localhost:3001/api/requests`
   - Method: GET

6. **GET** - Get DLQ Messages
   - URL: `http://localhost:3001/api/dlq`
   - Method: GET

7. **POST** - Retry All DLQ
   - URL: `http://localhost:3001/api/dlq/retry-all`
   - Method: POST

8. **GET** - Get Logs
   - URL: `http://localhost:8442/api/logs`
   - Method: GET

---

## 📊 Database Schema

### PostgreSQL Tables

#### templates
```sql
CREATE TABLE templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  subject VARCHAR(500) NOT NULL,
  html_content TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

#### requests
```sql
CREATE TABLE requests (
  id SERIAL PRIMARY KEY,
  user_name VARCHAR(255) NOT NULL,
  user_email VARCHAR(255) NOT NULL,
  template_id INTEGER REFERENCES templates(id),
  data JSONB DEFAULT '{}',
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMPTZ
);
```

#### dead_letter_queue
```sql
CREATE TABLE dead_letter_queue (
  id SERIAL PRIMARY KEY,
  request_id INTEGER NOT NULL,
  user_name VARCHAR(255),
  user_email VARCHAR(255),
  template_id INTEGER,
  data JSONB,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  retry_attempted BOOLEAN DEFAULT false,
  failed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

### MongoDB Collections

#### notification_logs.logs
- Service logs from producer and consumer
- Real-time log streaming data

#### system_logs.system_events
- System-level events and metrics

---

## 🔧 Configuration & Scaling

### Scaling Consumer Services

Edit `docker-compose.yml`:
```yaml
consumer:
  # ... other config
  deploy:
    replicas: 5  # Increase number of consumers for better throughput
```

Then restart:
```bash
docker-compose up -d --scale consumer=5
```

### Adjusting Redis Memory
```yaml
redis:
  command: redis-server --maxmemory 512mb --maxmemory-policy allkeys-lru
```

### Kafka Partitions

For better parallelism, increase partitions in `producer/index.js`:
```javascript
const requiredTopics = [
  { topic: 'notification-requests', numPartitions: 10, replicationFactor: 1 }
];
```

---

## 🐛 Troubleshooting

### Services Won't Start
```bash
# Check service logs
docker-compose logs <service-name>

# Example: Check producer logs
docker-compose logs producer

# Restart specific service
docker-compose restart <service-name>

# Rebuild and restart
docker-compose up -d --build <service-name>
```

### Emails Not Sending

1. **Check SMTP credentials in `.env` file**
```bash
   cat .env | grep SMTP
```

2. **Check consumer logs**
```bash
   docker-compose logs consumer
```

3. **Verify Kafka is running**
```bash
   docker-compose ps kafka
```

4. **Check DLQ for failed messages**
```bash
   curl http://localhost:3001/api/dlq
```

5. **Test SMTP connection manually**
```bash
   # Access consumer container
   docker-compose exec consumer sh
   
   # Try sending test email
   node -e "
   const nodemailer = require('nodemailer');
   const transport = nodemailer.createTransport({
     host: 'smtp.gmail.com',
     port: 587,
     auth: { user: 'your-email@gmail.com', pass: 'your-password' }
   });
   transport.verify().then(console.log).catch(console.error);
   "
```

### Connection Errors
```bash
# Reset everything
docker-compose down -v
docker-compose up -d

# Check network
docker network ls
docker network inspect email-notification-system_notification_network

# Check service connectivity
docker-compose exec producer ping -c 3 kafka
docker-compose exec producer ping -c 3 postgres
```

### Port Already in Use
```bash
# Find process using port 3000
lsof -i :3000
# Or on Windows
netstat -ano | findstr :3000

# Kill the process or change port in docker-compose.yml
```

### Database Connection Issues
```bash
# Check PostgreSQL logs
docker-compose logs postgres

# Access PostgreSQL directly
docker-compose exec postgres psql -U admin -d notificationdb

# List tables
\dt

# Check templates
SELECT * FROM templates;
```

---

## 📈 Performance Tips

1. **Enable Redis Caching**
   - Reduces database load for template fetches
   - Automatically enabled in the system

2. **Scale Consumers**
```bash
   docker-compose up -d --scale consumer=5
```

3. **Increase Kafka Partitions**
   - Better message distribution
   - Edit producer code and restart

4. **Use Bulk API**
   - Send multiple notifications in one request
   - More efficient than individual requests

5. **Monitor Logs**
   - Watch for bottlenecks at http://localhost:8442
   - Check error rates and response times

6. **Database Optimization**
   - Indexes are pre-configured in init.sql
   - Regular cleanup of old logs

---

## 🔒 Security Best Practices

### For Production Deployment:

1. **Change Default Passwords**
```yaml
   # In docker-compose.yml
   postgres:
     environment:
       POSTGRES_PASSWORD: <strong-password>
   
   mongo:
     environment:
       MONGO_INITDB_ROOT_PASSWORD: <strong-password>
```

2. **Use Environment Variables**
   - Never commit `.env` file to git
   - Add `.env` to `.gitignore`

3. **Enable TLS/SSL**
```yaml
   kafka:
     environment:
       KAFKA_SSL_ENABLED: 'true'
```

4. **Implement API Authentication**
```javascript
   // Add middleware in producer/index.js
   app.use('/api', authMiddleware);
```

5. **Secure SMTP Connection**
```yaml
   consumer:
     environment:
       SMTP_SECURE: 'true'
       SMTP_PORT: 465
```

6. **Network Isolation**
   - Use Docker networks
   - Expose only necessary ports

---

## 💡 Advanced Usage

### Custom Email Templates

#### Using the Template Editor (Recommended)
1. Go to http://localhost:3000
2. Click "**+ New**"
3. Use the visual editor or switch to code mode
4. Add variables like `{{custom_field}}`
5. Save and test

#### Via API
```bash
curl -X POST http://localhost:3001/api/templates \
  -H "Content-Type: application/json" \
  -d '{
    "name": "password_reset",
    "description": "Password reset email",
    "subject": "Reset your password",
    "html_content": "<html><body><h1>Hi {{user_name}}</h1><p>Click here: {{reset_link}}</p></body></html>",
    "variables": ["user_name", "reset_link"]
  }'
```

### Scheduled Emails

You can integrate with cron or external schedulers:
```bash
# Create a script: send_daily_report.sh
#!/bin/bash
curl -X POST http://localhost:3001/api/notifications \
  -H "Content-Type: application/json" \
  -d '{
    "user_name": "Admin",
    "user_email": "admin@example.com",
    "template_id": 3,
    "data": {
      "date": "'$(date +%Y-%m-%d)'",
      "report_url": "https://example.com/reports"
    }
  }'
```

Add to crontab:
```bash
# Run daily at 9 AM
0 9 * * * /path/to/send_daily_report.sh
```

### Webhook Integration

Send notifications when external events occur:
```bash
# Webhook endpoint example
curl -X POST http://localhost:3001/api/notifications \
  -H "Content-Type: application/json" \
  -d '{
    "user_name": "Customer",
    "user_email": "customer@example.com",
    "template_id": 2,
    "data": {
      "event": "payment_received",
      "amount": "$99.99",
      "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
    }
  }'
```

---

## 📚 API Response Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Request successful |
| 201 | Created | Resource created successfully |
| 404 | Not Found | Resource doesn't exist |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error occurred |
| 503 | Service Unavailable | Kafka not ready |

---

## 🎓 Learning Resources

### Understanding the System

1. **Kafka Basics**
   - Producer sends messages to topics
   - Consumer reads messages from topics
   - Topics are divided into partitions

2. **Dead Letter Queue (DLQ)**
   - Failed messages go to DLQ
   - Can be retried manually
   - Prevents message loss

3. **Template Variables**
   - Use `{{variable_name}}` syntax
   - Replaced at runtime with actual data
   - Works in both subject and body

### Common Patterns

#### Transactional Emails
```bash
# Order confirmation
curl -X POST http://localhost:3001/api/notifications \
  -H "Content-Type: application/json" \
  -d '{
    "user_name": "Customer",
    "user_email": "customer@example.com",
    "template_id": 2,
    "data": {
      "order_id": "ORD-123",
      "total": "$199.99"
    }
  }'
```

#### Marketing Emails
```bash
# Newsletter
curl -X POST http://localhost:3001/api/notifications \
  -H "Content-Type: application/json" \
  -d '[
    {"user_name": "User1", "user_email": "user1@example.com", "template_id": 4, "data": {}},
    {"user_name