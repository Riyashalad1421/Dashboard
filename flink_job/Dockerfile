FROM flink:1.17

USER root

# Install Python, pip, and Java 11
RUN apt-get update && \
    apt-get install -y python3 python3-pip openjdk-11-jdk-headless curl && \
    ln -sf /usr/bin/python3 /usr/bin/python && \
    mkdir -p /opt/java/openjdk && \
    ln -s /usr/lib/jvm/java-11-openjdk-*/include /opt/java/openjdk && \
    apt-get clean

# Set working directory
WORKDIR /opt/flink/usrlib/

# Install PyFlink
RUN pip install apache-flink==1.17.2

# Add Flink Kafka and JSON connectors
RUN curl -fSL -o /opt/flink/lib/flink-connector-kafka-1.17.2.jar https://repo1.maven.org/maven2/org/apache/flink/flink-connector-kafka/1.17.2/flink-connector-kafka-1.17.2.jar && \
    curl -fSL -o /opt/flink/lib/flink-connector-base-1.17.2.jar https://repo1.maven.org/maven2/org/apache/flink/flink-connector-base/1.17.2/flink-connector-base-1.17.2.jar && \
    curl -fSL -o /opt/flink/lib/flink-json-1.17.2.jar https://repo1.maven.org/maven2/org/apache/flink/flink-json/1.17.2/flink-json-1.17.2.jar && \
    curl -fSL -o /opt/flink/lib/flink-sql-connector-kafka-1.17.2.jar https://repo1.maven.org/maven2/org/apache/flink/flink-sql-connector-kafka/1.17.2/flink-sql-connector-kafka-1.17.2.jar && \
    curl -fSL -o /opt/flink/lib/kafka-clients-3.2.3.jar https://repo1.maven.org/maven2/org/apache/kafka/kafka-clients/3.2.3/kafka-clients-3.2.3.jar

# Copy the PyFlink job
COPY taxi_stream.py .

# Default command will be handled by docker-compose