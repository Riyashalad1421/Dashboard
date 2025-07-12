#!/bin/bash
set -e

check_host_port() {
  hostport="$1"
  host="${hostport%%:*}"
  port="${hostport##*:}"
  while ! nc -z "$host" "$port"; do
    echo "⏳ Waiting for $host:$port..."
    sleep 2
  done
  echo "✅ $host:$port is up"
}

# Loop through all host:port args until non-host:port found
while [[ "$1" == *:* ]]; do
  check_host_port "$1"
  shift
done

# Launch the actual app
exec "$@"