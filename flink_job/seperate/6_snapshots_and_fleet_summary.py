from pyflink.table import StreamTableEnvironment

KAFKA_SERVERS = "kafka:9092"
GROUP_ID = "yash-flink-debug-7"
table_env = StreamTableEnvironment.create(...)

table_env.execute_sql(f"""
CREATE TABLE taxi_location_snapshots (
    taxi_id STRING,
    date_time STRING,
    longitude DOUBLE,
    latitude DOUBLE
) WITH (
    'connector' = 'kafka',
    'topic' = 'taxi_location_snapshots',
    'properties.bootstrap.servers' = '{KAFKA_SERVERS}',
    'properties.group.id' = '{GROUP_ID}',
    'format' = 'json'
)
""")
table_env.execute_sql("""
INSERT INTO taxi_location_snapshots
SELECT taxi_id, date_time, longitude, latitude
FROM (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY taxi_id ORDER BY ts) AS rn
    FROM taxi_location
)
WHERE rn % 10 = 0
""")
table_env.execute_sql("""
CREATE TEMPORARY VIEW taxi_windowed_ids AS
SELECT 
    taxi_id,
    TUMBLE_START(ts, INTERVAL '10' MINUTE) AS window_start
FROM taxi_location
GROUP BY taxi_id, TUMBLE(ts, INTERVAL '10' MINUTE)
""")
table_env.execute_sql(f"""
CREATE TABLE taxi_fleet_summary (
    window_start TIMESTAMP(3),
    taxi_count BIGINT,
    PRIMARY KEY (window_start) NOT ENFORCED
) WITH (
    'connector' = 'upsert-kafka',
    'topic' = 'taxi_fleet_summary',
    'properties.bootstrap.servers' = '{KAFKA_SERVERS}',
    'key.format' = 'json',
    'value.format' = 'json'
)
""")
table_env.execute_sql("""
INSERT INTO taxi_fleet_summary
SELECT 
    window_start,
    COUNT(*) AS taxi_count
FROM taxi_windowed_ids
GROUP BY window_start
""")