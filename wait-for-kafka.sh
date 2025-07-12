#!/bin/bash
set -e

# First 2 args: host and port
host="$1"
port="$2"
shift 2

echo "⏳ Waiting for Kafka to be ready at $host:$port..."

# Loop until Kafka is reachable
while ! nc -z "$host" "$port"; do
  echo "Still waiting for $host:$port..."
  sleep 2
done

echo "✅ Kafka is available, proceeding..."

# Execute the remaining command
exec "$@"