# 📧 Email Notification System

A scalable, event-driven email notification system built with Node.js, Kafka, PostgreSQL, Redis, and MongoDB. This system provides a complete solution for managing email templates, queuing notifications, and monitoring system logs in real-time.

## 🌟 Why This System Matters

In today's digital landscape, timely and reliable email communication is critical for business success. This notification system serves as a robust backbone for automated email delivery across diverse use cases. Whether you're running an **e-commerce platform** that needs to send order confirmations, shipping updates, and abandoned cart reminders; a **SaaS application** requiring user onboarding emails, password resets, and feature announcements; a **financial institution** delivering transaction alerts, account statements, and security notifications; or a **healthcare system** managing appointment reminders, test results, and prescription notifications - this system handles it all with enterprise-grade reliability. The event-driven architecture ensures that even during peak loads or system failures, no notification is lost, while the dead letter queue guarantees failed messages can be investigated and retried. With built-in rate limiting, you can prevent spam and comply with email provider restrictions, while the template management system allows marketing teams to update email designs without developer intervention. Real-time monitoring gives you complete visibility into your email delivery pipeline, helping you track success rates, identify bottlenecks, and debug issues instantly. From sending millions of marketing newsletters to critical transactional alerts, from multi-tenant SaaS platforms to internal enterprise systems, this notification service adapts to your scale and reliability requirements. The system's decoupled design means your main application never blocks waiting for emails to send - notifications are queued instantly and processed asynchronously, ensuring optimal application performance and user experience.

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


## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/ekelejames/email-notification-system.git
cd email-notification-system
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

### Step 4: Send test nofication via the UI or do using API

### Through API: Send a Test Email (Replace with YOUR email)
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
