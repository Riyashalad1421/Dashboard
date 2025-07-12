import os
from pyflink.datastream import StreamExecutionEnvironment
from pyflink.table import EnvironmentSettings, StreamTableEnvironment

# Constants
GROUP_ID = "yash-flink-debug-7"
INPUT_TOPIC = "taxi-location"
KAFKA_SERVERS = "kafka:9092"

# Initialize Flink environment
env = StreamExecutionEnvironment.get_execution_environment()
settings = EnvironmentSettings.new_instance().in_streaming_mode().build()
table_env = StreamTableEnvironment.create(env, environment_settings=settings)

# Source Table
table_env.execute_sql(f"""
CREATE TABLE taxi_location (
    taxi_id STRING,
    date_time STRING,
    longitude DOUBLE,
    latitude DOUBLE,
    ts AS TO_TIMESTAMP_LTZ(CAST(UNIX_TIMESTAMP(date_time) * 1000 AS BIGINT), 3),
    WATERMARK FOR ts AS ts - INTERVAL '5' SECOND
) WITH (
    'connector' = 'kafka',
    'topic' = '{INPUT_TOPIC}',
    'properties.bootstrap.servers' = '{KAFKA_SERVERS}',
    'properties.group.id' = '{GROUP_ID}',
    'scan.startup.mode' = 'earliest-offset',
    'format' = 'json',
    'json.fail-on-missing-field' = 'false',
    'json.ignore-parse-errors' = 'true'
)
""")

# Speed Events Table (sink)
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

# Speed Events Source View
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

# Average Speed Table
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

# Distance Tracker
table_env.execute_sql("""
CREATE TEMPORARY VIEW taxi_distance_hops AS
SELECT 
    taxi_id,
    SQRT(
        POWER(longitude - LAG(longitude) OVER (PARTITION BY taxi_id ORDER BY ts), 2) +
        POWER(latitude - LAG(latitude) OVER (PARTITION BY taxi_id ORDER BY ts), 2)
    ) * 111 AS hop_distance
FROM taxi_location
""")

table_env.execute_sql(f"""
CREATE TABLE taxi_distance_updates (
    taxi_id STRING,
    total_distance DOUBLE,
    PRIMARY KEY (taxi_id) NOT ENFORCED
) WITH (
    'connector' = 'upsert-kafka',
    'topic' = 'taxi_distance_updates',
    'properties.bootstrap.servers' = '{KAFKA_SERVERS}',
    'key.format' = 'json',
    'value.format' = 'json'
)
""")

table_env.execute_sql("""
INSERT INTO taxi_distance_updates
SELECT 
    taxi_id,
    SUM(hop_distance) AS total_distance
FROM taxi_distance_hops
GROUP BY taxi_id
""")

# Violation Alerts
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

# Snapshots (every 10th record)
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

# Fleet Summary
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
