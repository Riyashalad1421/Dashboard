from pyflink.table import StreamTableEnvironment

KAFKA_SERVERS = "kafka:9092"
table_env = StreamTableEnvironment.create(...)

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