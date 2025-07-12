from pyflink.table import StreamTableEnvironment

KAFKA_SERVERS = "kafka:9092"
GROUP_ID = "yash-flink-debug-7"
table_env = StreamTableEnvironment.create(...)

table_env.execute_sql(f"""
CREATE TABLE taxi_speed_events (
    taxi_id STRING,
    date_time STRING,
    speed DOUBLE
) WITH (
    'connector' = 'kafka',
    'topic' = 'taxi_speed_events',
    'properties.bootstrap.servers' = '{KAFKA_SERVERS}',
    'properties.group.id' = '{GROUP_ID}',
    'format' = 'json'
)
""")

table_env.execute_sql("""
INSERT INTO taxi_speed_events
SELECT 
    taxi_id,
    date_time,
    SQRT(
        POWER(longitude - LAG(longitude) OVER (PARTITION BY taxi_id ORDER BY ts), 2) +
        POWER(latitude - LAG(latitude) OVER (PARTITION BY taxi_id ORDER BY ts), 2)
    ) * 111 AS speed
FROM taxi_location
""")