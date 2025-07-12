import os
import time
import subprocess

group_id = f"flink-consumer-debug-{int(time.time())}"
os.environ['GROUP_ID'] = group_id

subprocess.run([
    "/opt/flink/bin/flink",
    "run",
    "-m", "flink-jobmanager:8081",
    "-py", "/opt/flink/usrlib/taxi_stream.py"
])