-- Create templates table
CREATE TABLE IF NOT EXISTS templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    subject VARCHAR(500) NOT NULL,
    html_content TEXT NOT NULL,
    variables JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create requests table
CREATE TABLE IF NOT EXISTS requests (
    id SERIAL PRIMARY KEY,
    user_name VARCHAR(255) NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    template_id INTEGER REFERENCES templates(id),
    status VARCHAR(50) DEFAULT 'pending',
    data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP
);

-- Create notifications log table
CREATE TABLE IF NOT EXISTS notification_logs (
    id SERIAL PRIMARY KEY,
    request_id INTEGER REFERENCES requests(id),
    status VARCHAR(50) NOT NULL,
    error_message TEXT,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample templates
INSERT INTO templates (name, description, subject, html_content, variables) VALUES
('welcome_email', 'Welcome email for new users', 'Welcome to Our Platform, {{user_name}}!', 
'<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4CAF50; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .button { background: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; display: inline-block; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Welcome {{user_name}}!</h1>
        </div>
        <div class="content">
            <p>Hello {{user_name}},</p>
            <p>Thank you for joining our platform. We are excited to have you on board!</p>
            <p>Your email: <strong>{{user_email}}</strong></p>
            <p>Registration date: <strong>{{registration_date}}</strong></p>
            <p style="text-align: center; margin-top: 30px;">
                <a href="{{dashboard_url}}" class="button">Go to Dashboard</a>
            </p>
        </div>
    </div>
</body>
</html>',
'["user_name", "user_email", "registration_date", "dashboard_url"]'::jsonb
),
('order_confirmation', 'Order confirmation email', 'Order Confirmation #{{order_id}}',
'<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2196F3; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .order-details { background: white; padding: 15px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Order Confirmed!</h1>
        </div>
        <div class="content">
            <p>Dear {{user_name}},</p>
            <p>Your order has been confirmed and is being processed.</p>
            <div class="order-details">
                <p><strong>Order ID:</strong> {{order_id}}</p>
                <p><strong>Total Amount:</strong> {{total_amount}}</p>
                <p><strong>Delivery Address:</strong> {{delivery_address}}</p>
                <p><strong>Expected Delivery:</strong> {{delivery_date}}</p>
            </div>
            <p>Thank you for your purchase!</p>
        </div>
    </div>
</body>
</html>',
'["user_name", "order_id", "total_amount", "delivery_address", "delivery_date"]'::jsonb
);

-- Insert sample requests
INSERT INTO requests (user_name, user_email, template_id, data) VALUES
('John Doe', 'john.doe@example.com', 1, '{"registration_date": "2025-10-06", "dashboard_url": "https://example.com/dashboard"}'::jsonb),
('Jane Smith', 'jane.smith@example.com', 2, '{"order_id": "ORD-12345", "total_amount": "$199.99", "delivery_address": "123 Main St, City", "delivery_date": "2025-10-10"}'::jsonb);

-- Create function to update timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for templates
CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON templates
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();