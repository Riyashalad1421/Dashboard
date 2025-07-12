from pyflink.table import StreamTableEnvironment

KAFKA_SERVERS = "kafka:9092"
table_env = StreamTableEnvironment.create(...)

table_env.execute_sql(f"""
CREATE TEMPORARY TABLE taxi_speed_source (
    taxi_id STRING,
    date_time STRING,
    speed DOUBLE
) WITH (
    'connector' = 'kafka',
    'topic' = 'taxi_speed_events',
    'properties.bootstrap.servers' = '{KAFKA_SERVERS}',
    'scan.startup.mode' = 'earliest-offset',
    'format' = 'json'
)
""")

table_env.execute_sql(f"""
CREATE TABLE taxi_avg_speed_updates (
    taxi_id STRING,
    avg_speed DOUBLE,
    PRIMARY KEY (taxi_id) NOT ENFORCED
) WITH (
    'connector' = 'upsert-kafka',
    'topic' = 'taxi_avg_speed_updates',
    'properties.bootstrap.servers' = '{KAFKA_SERVERS}',
    'key.format' = 'json',
    'value.format' = 'json'
)
""")

table_env.execute_sql("""
INSERT INTO taxi_avg_speed_updates
SELECT 
    taxi_id,
    AVG(speed) AS avg_speed
FROM taxi_speed_source
GROUP BY taxi_id
""")