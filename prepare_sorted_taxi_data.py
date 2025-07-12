import os
import csv
from datetime import datetime

# Update this to your real path
DATA_DIR = "/Users/yashindulkar/traffic-monitoring/producer/data"
OUTPUT_CSV = "/Users/yashindulkar/traffic-monitoring/producer/sorted_taxi_data.csv"

all_records = []
file_count = 0
row_count = 0

# Loop through each .txt file
for file_name in os.listdir(DATA_DIR):
    if not file_name.endswith(".txt"):
        continue

    taxi_id = file_name.replace(".txt", "")
    file_path = os.path.join(DATA_DIR, file_name)
    file_count += 1

    with open(file_path, "r") as f:
        for line in f:
            parts = line.strip().split(",")
            if len(parts) != 4:
                continue

            try:
                date_time = datetime.strptime(parts[1], "%Y-%m-%d %H:%M:%S")
                all_records.append({
                    "taxi_id": taxi_id,
                    "date_time": parts[1],
                    "longitude": float(parts[2]),
                    "latitude": float(parts[3]),
                    "ts": date_time
                })
                row_count += 1
            except Exception as e:
                print(f"❌ Error in file {file_name}, row: {parts}, error: {e}")

print(f"📁 Processed {file_count} files, ✅ Parsed {row_count} valid rows.")

# Sort all by timestamp
all_records.sort(key=lambda x: x["ts"])

# Write to combined CSV
with open(OUTPUT_CSV, "w", newline="") as f:
    writer = csv.writer(f)
    writer.writerow(["taxi_id", "date_time", "longitude", "latitude"])
    for row in all_records:
        writer.writerow([row["taxi_id"], row["date_time"], row["longitude"], row["latitude"]])

print(f"✅ CSV written: {OUTPUT_CSV} with {len(all_records)} rows.")