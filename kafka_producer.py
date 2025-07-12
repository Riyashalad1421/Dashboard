import csv
import time
import json
import socket
from kafka import KafkaProducer

# Constants - OPTIMIZED FOR HIGHER THROUGHPUT
CSV_FILE = "sorted_taxi_data.csv"
KAFKA_TOPIC = "taxi-location"
KAFKA_SERVER = "kafka:9092"

# REDUCED DELAY OPTIONS (choose one):
SEND_DELAY = 0.0001  # ~10,000 messages/sec (10x faster)
# SEND_DELAY = 0.0005  # ~2,000 messages/sec (2x faster - conservative)
# SEND_DELAY = 0        # No delay - maximum throughput (use with caution)

# Wait for Kafka broker
def wait_for_kafka(host, port, timeout=30):
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            with socket.create_connection((host, port), timeout=2):
                print("✅ Kafka is ready.")
                return
        except OSError:
            print("⏳ Waiting for Kafka...")
            time.sleep(2)
    raise TimeoutError("❌ Kafka broker not available after waiting.")

wait_for_kafka("kafka", 9092)

# OPTIMIZED Kafka Producer Configuration
producer = KafkaProducer(
    bootstrap_servers=KAFKA_SERVER,
    value_serializer=lambda v: json.dumps(v).encode("utf-8"),
    
    # PERFORMANCE OPTIMIZATIONS:
    linger_ms=5,           # Reduced from 10ms - faster batching
    batch_size=128 * 1024, # Increased from 64KB to 128KB - larger batches
    buffer_memory=64 * 1024 * 1024,  # 64MB buffer - handle bursts
    compression_type='lz4', # Add compression for better throughput
    acks=1,                # Keep acks=1 for good balance
    retries=3,             # Add retries for reliability
    max_in_flight_requests_per_connection=10,  # Allow more concurrent requests
)

# 🚀 OPTIMIZED Stream from CSV
count = 0
start_time = time.time()

print(f"🚀 Starting to stream with {SEND_DELAY*1000:.1f}ms delay ({1/SEND_DELAY if SEND_DELAY > 0 else 'MAX'} msg/sec)")

with open(CSV_FILE, newline='') as f:
    reader = csv.DictReader(f)
    
    for row in reader:
        msg = {
            "taxi_id": row["taxi_id"],
            "date_time": row["date_time"],
            "longitude": float(row["longitude"]),
            "latitude": float(row["latitude"])
        }
        
        # Send message
        producer.send(KAFKA_TOPIC, value=msg)
        count += 1
        
        # Progress reporting (less frequent for performance)
        if count % 5000 == 0:  # Report every 5k instead of 1k
            elapsed = time.time() - start_time
            rate = count / elapsed if elapsed > 0 else 0
            print(f"📦 Sent {count} messages... Rate: {rate:.0f} msg/sec")
        
        # CONDITIONAL DELAY - only sleep if delay > 0
        if SEND_DELAY > 0:
            time.sleep(SEND_DELAY)

# Final flush and cleanup
producer.flush()
producer.close()

elapsed = time.time() - start_time
final_rate = count / elapsed if elapsed > 0 else 0
print(f"✅ Finished streaming {count} rows in {elapsed:.2f}s")
print(f"📊 Average rate: {final_rate:.0f} messages/sec")
print(f"🎯 Target rate was: {1/SEND_DELAY if SEND_DELAY > 0 else 'MAX'} msg/sec")