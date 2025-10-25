1. docker-compose up -d --build

# to log into mongo express, it runs on port 8084
username = admin
password = admin_pass


# the logs of the system are found under 'notification_logs'
# the collection under 'notification_logs' is 'logs'

# create connectors to sink the messages into database too
curl -X POST -H "Content-Type: application/json" --data @mongo-sink-notification-requests.json http://localhost:8083/connectors
curl -X POST -H "Content-Type: application/json" --data @mongo-sink-dlq.json http://localhost:8083/connectors


# get all connectors
curl http://localhost:8083/connectors

# the kafka messages are found in 'kafka_messages' database