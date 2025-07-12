from pyflink.table import StreamTableEnvironment

KAFKA_SERVERS = "kafka:9092"
GROUP_ID = "yash-flink-debug-7"
table_env = StreamTableEnvironment.create(...)

table_env.execute_sql(f"""
CREATE TABLE taxi_violation_alerts (
    taxi_id STRING,
    date_time STRING,
    speed DOUBLE
) WITH (
    'connector' = 'kafka',
    'topic' = 'taxi_violation_alerts',
    'properties.bootstrap.servers' = '{KAFKA_SERVERS}',
    'properties.group.id' = '{GROUP_ID}',
    'format' = 'json'
)
""")

table_env.execute_sql("""
INSERT INTO taxi_violation_alerts
SELECT 
    taxi_id,
    date_time,
    speed
FROM taxi_speed_source
WHERE speed > 80
""")