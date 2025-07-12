FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && \
    apt-get install -y netcat-openbsd curl && \
    apt-get clean

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
 && pip install --no-cache-dir -r requirements.txt

# Copy application code and wait script
COPY . .
COPY wait-for-services.sh .

# Make wait script executable
RUN chmod +x wait-for-services.sh

# Expose FastAPI port
EXPOSE 8000

# CMD to start FastAPI after checking Kafka and Redis
CMD ["./wait-for-services.sh", "kafka:9092", "redis:6379", "uvicorn", "fastapi_kafka_consumer:app", "--host", "0.0.0.0", "--port", "8000"]