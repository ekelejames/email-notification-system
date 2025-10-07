#!/bin/bash

# Email Notification System Setup Script

echo "================================================"
echo "  Email Notification System - Setup Script"
echo "================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker is not installed. Please install Docker first.${NC}"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}✗ Docker Compose is not installed. Please install Docker Compose first.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Docker and Docker Compose are installed${NC}"
echo ""

# Create directory structure
echo "Creating project structure..."
mkdir -p producer consumer frontend

echo -e "${GREEN}✓ Directories created${NC}"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠ .env file not found${NC}"
    echo "Please create a .env file with your SMTP credentials."
    echo "You can copy .env.example and fill in your details:"
    echo ""
    echo "  cp .env.example .env"
    echo "  nano .env  # or use your favorite editor"
    echo ""
    read -p "Press Enter after creating .env file, or Ctrl+C to exit..."
fi

echo ""
echo "Building Docker containers..."
echo "This may take a few minutes on first run..."
echo ""

docker-compose build

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Build failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✓ Containers built successfully${NC}"
echo ""
echo "Starting services..."
echo ""

docker-compose up -d

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Failed to start services${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✓ Services started${NC}"
echo ""
echo "Waiting for services to initialize..."
echo "This may take 30-60 seconds..."
echo ""

# Wait for services
sleep 30

echo "Checking service status..."
echo ""

# Check if services are running
POSTGRES_STATUS=$(docker-compose ps postgres | grep "Up" | wc -l)
KAFKA_STATUS=$(docker-compose ps kafka | grep "Up" | wc -l)
PRODUCER_STATUS=$(docker-compose ps producer | grep "Up" | wc -l)
CONSUMER_STATUS=$(docker-compose ps consumer | grep "Up" | wc -l)
FRONTEND_STATUS=$(docker-compose ps frontend | grep "Up" | wc -l)

if [ $POSTGRES_STATUS -eq 0 ]; then
    echo -e "${RED}✗ PostgreSQL is not running${NC}"
else
    echo -e "${GREEN}✓ PostgreSQL is running${NC}"
fi

if [ $KAFKA_STATUS -eq 0 ]; then
    echo -e "${RED}✗ Kafka is not running${NC}"
else
    echo -e "${GREEN}✓ Kafka is running${NC}"
fi

if [ $PRODUCER_STATUS -eq 0 ]; then
    echo -e "${RED}✗ Producer service is not running${NC}"
else
    echo -e "${GREEN}✓ Producer service is running${NC}"
fi

if [ $CONSUMER_STATUS -eq 0 ]; then
    echo -e "${RED}✗ Consumer service is not running${NC}"
else
    echo -e "${GREEN}✓ Consumer service is running${NC}"
fi

if [ $FRONTEND_STATUS -eq 0 ]; then
    echo -e "${RED}✗ Frontend is not running${NC}"
else
    echo -e "${GREEN}✓ Frontend is running${NC}"
fi

echo ""
echo "================================================"
echo -e "${GREEN}  Setup Complete!${NC}"
echo "================================================"
echo ""
echo "Access the application:"
echo "  📱 Frontend:     http://localhost:3000"
echo "  🔌 API:          http://localhost:3001"
echo "  🗄️  Database:     localhost:5432"
echo ""
echo "Useful commands:"
echo "  View logs:       docker-compose logs -f"
echo "  Stop services:   docker-compose down"
echo "  Restart:         docker-compose restart"
echo ""
