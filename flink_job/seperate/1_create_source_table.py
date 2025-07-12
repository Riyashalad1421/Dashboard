from pyflink.datastream import StreamExecutionEnvironment
from pyflink.table import EnvironmentSettings, StreamTableEnvironment

GROUP_ID = "yash-flink-debug-7"
INPUT_TOPIC = "taxi-location"
KAFKA_SERVERS = "kafka:9092"

env = StreamExecutionEnvironment.get_execution_environment()
settings = EnvironmentSettings.new_instance().in_streaming_mode().build()
table_env = StreamTableEnvironment.create(env, environment_settings=settings)

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