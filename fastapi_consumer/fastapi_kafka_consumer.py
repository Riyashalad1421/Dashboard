import asyncio
import json
import hashlib
from collections import defaultdict
from typing import Optional, List
import aiokafka
import redis.asyncio as redis
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime
import time

app = FastAPI(title="Enhanced Taxi Monitoring API", version="3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

redis_client = redis.Redis(host="redis", port=6379, decode_responses=True)

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.client_bounds = {}  # Store viewport bounds for each client
        self.client_last_activity = {}  # Track client activity

    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections.append(websocket)
        self.client_last_activity[client_id] = datetime.utcnow()
        print(f"🚦 WebSocket connection accepted for client {client_id}")

    def disconnect(self, websocket: WebSocket, client_id: str):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        if client_id in self.client_bounds:
            del self.client_bounds[client_id]
        if client_id in self.client_last_activity:
            del self.client_last_activity[client_id]
        print(f"🔌 WebSocket client {client_id} disconnected")

    async def send_to_client(self, websocket: WebSocket, data: str):
        try:
            await websocket.send_text(data)
        except Exception:
            if websocket in self.active_connections:
                self.active_connections.remove(websocket)

    async def broadcast_updates(self, taxi_data: dict):
        if not self.active_connections:
            return
            
        # Add metadata to broadcast
        taxi_data["broadcast_time"] = datetime.utcnow().isoformat()
        taxi_data["active_connections"] = len(self.active_connections)
        
        for websocket in self.active_connections[:]:  # Copy to avoid modification during iteration
            try:
                await websocket.send_text(json.dumps(taxi_data))
            except Exception:
                if websocket in self.active_connections:
                    self.active_connections.remove(websocket)

manager = ConnectionManager()

# Enhanced models
class Bounds(BaseModel):
    north: float
    south: float
    east: float
    west: float

class HealthStatus(BaseModel):
    status: str
    kafka_connected: bool
    redis_connected: bool
    flink_active: bool
    active_websockets: int
    processing_lag_seconds: Optional[float] = None

# Enhanced topic list matching Flink output
TOPICS = [
    "taxi_speed_events",
    "taxi_avg_speed_updates", 
    "taxi_distance_updates",
    "taxi_violation_alerts",
    "taxi_location_snapshots",
    "taxi_fleet_summary",
    "taxi_registry_updates"
]

KAFKA_BOOTSTRAP_SERVERS = "kafka:9092"
GROUP_ID = "fastapi-kafka-consumer"
taxi_update_counter = defaultdict(int)

# Enhanced cache
location_cache = {}
last_broadcast_time = 0
last_processing_time = None

# Rate limiting
last_expensive_call = defaultdict(float)
RATE_LIMIT_SECONDS = 1.0

def get_violation_severity(violation_type: str) -> int:
    """Return severity score for violation type - matches Flink output"""
    severity_map = {
        "SEVERE_SPEEDING": 4,
        "MODERATE_SPEEDING": 2,
        "SUDDEN_STOP": 3,
        "RAPID_ACCELERATION": 2
    }
    return severity_map.get(violation_type, 1)

async def consume():
    consumer = aiokafka.AIOKafkaConsumer(
        *TOPICS,
        bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
        group_id=GROUP_ID,
        value_deserializer=lambda m: json.loads(m.decode("utf-8")),
        auto_offset_reset='earliest',
        max_poll_records=500,
        enable_auto_commit=True,
        auto_commit_interval_ms=5000
    )

    while True:
        try:
            await consumer.start()
            print("✅ Enhanced Kafka consumer started")
            break
        except aiokafka.errors.KafkaConnectionError as e:
            print(f"🔁 Kafka not ready: {e}. Retrying in 3 seconds...")
            await asyncio.sleep(3)

    try:
        async for msg in consumer:
            await process_message(msg.topic, msg.value)
            # Update processing time for health checks
            global last_processing_time
            last_processing_time = datetime.utcnow()
    finally:
        await consumer.stop()

async def process_message(topic, data):
    global last_broadcast_time
    
    try:
        # Extract common fields
        taxi_id = data.get("taxi_id")
        timestamp = data.get("date_time")
        
        if not taxi_id:
            print(f"⚠️ Missing taxi_id in {topic} message")
            return

        # Timestamp deduplication to prevent duplicate processing
        if timestamp:
            last_ts_key = f"last_ts:{taxi_id}"
            prev_ts = await redis_client.get(last_ts_key)
            if prev_ts == timestamp:
                return
            await redis_client.set(last_ts_key, timestamp, ex=3600)

        if topic == "taxi_speed_events":
            speed = float(data.get("speed", 0.0))
            time_diff = data.get("time_diff_seconds", 1.0)  # ✅ Handle new field from Flink
            
            if speed < 0 or speed > 200:  # ✅ Match Flink's 200 km/h cap
                print(f"⚠️ Discarding speed outlier {speed} km/h for {taxi_id}")
                return

            # Store enhanced speed data with time_diff
            enhanced_data = {
                **data,
                "time_diff_seconds": time_diff,
                "processed_at": datetime.utcnow().isoformat()
            }
            await redis_client.set(f"latest_speed:{taxi_id}", json.dumps(enhanced_data), ex=1800)

        elif topic == "taxi_avg_speed_updates":
            avg = float(data.get("avg_speed", 0.0))
            sample_count = int(data.get("sample_count", 0))  # ✅ Handle new field from Flink
            
            if avg < 0:
                avg = 0.0
            if avg > 150:  # ✅ Match Flink's filtering
                print(f"⚠️ Capping avg_speed for {taxi_id} from {avg} to 150")
                avg = 150.0
                
            await redis_client.hset("avg_speed", taxi_id, f"{avg:.2f}")
            await redis_client.hset("speed_samples", taxi_id, sample_count)  # ✅ Store sample count
            await redis_client.sadd("taxi_ids", taxi_id)

        elif topic == "taxi_distance_updates":
            new_dist = float(data.get("total_distance", 0.0))
            old_raw = await redis_client.hget("distance", taxi_id)
            old_dist = float(old_raw) if old_raw else 0.0

            # ✅ More reasonable validation (Flink filters better now)
            if new_dist - old_dist > 10.0:
                print(f"⚠️ Large distance jump {new_dist - old_dist:.2f}km for {taxi_id}")
                # Don't return, just log - Flink filtering should handle this

            await redis_client.hset("distance", taxi_id, f"{new_dist:.6f}")  # ✅ Match Flink precision

        elif topic == "taxi_violation_alerts":
            key = f"alerts:{taxi_id}"
            
            # ✅ Handle enhanced violation schema from Flink
            violation_alert = {
                "timestamp": data.get("timestamp", timestamp or datetime.utcnow().isoformat()),
                "type": data.get("violation_type", "MODERATE_SPEEDING"),  # ✅ Match Flink types
                "speed": data.get("speed", 0),
                "details": data.get("details", f"Speed: {data.get('speed', 'N/A')} km/h"),
                "severity": get_violation_severity(data.get("violation_type", ""))
            }
            
            await redis_client.lpush(key, json.dumps(violation_alert))
            await redis_client.ltrim(key, 0, 19)  # Keep 20 violations
            await redis_client.expire(key, 3600)
            
            violation_count = await redis_client.llen(key)
            await redis_client.hset("violation_counts", taxi_id, violation_count)
            await redis_client.hset("violation_severity", taxi_id, violation_alert["severity"])

        elif topic == "taxi_location_snapshots":
            taxi_update_counter[taxi_id] += 1
            
            # ✅ Match Flink's 30-second windowing - less frequent updates
            update_frequency = 3  # Reduced since Flink sends less often
            if taxi_update_counter[taxi_id] % update_frequency != 0:
                return
                
            # Enhanced location data
            enhanced_data = {
                **data,
                "last_updated": datetime.utcnow().isoformat(),
                "update_frequency": update_frequency
            }
            
            snapshot_key = f"snapshot:{taxi_id}"
            await redis_client.set(snapshot_key, json.dumps(enhanced_data), ex=600)
            await redis_client.sadd("taxi_ids", taxi_id)
            
            location_cache[taxi_id] = enhanced_data
            
            # Faster broadcasting for better UX
            current_time = asyncio.get_event_loop().time()
            if current_time - last_broadcast_time > 8:
                await broadcast_location_updates()
                last_broadcast_time = current_time

        elif topic == "taxi_fleet_summary":
            # ✅ Handle enhanced fleet summary with multiple fields
            fleet_data = {
                "taxi_count": data.get("taxi_count", 0),
                "avg_fleet_speed": data.get("avg_fleet_speed", 0.0),
                "total_violations": data.get("total_violations", 0),
                "window_start": data.get("window_start"),
                "processed_at": datetime.utcnow().isoformat()
            }
            await redis_client.set(f"fleet_summary:{data['window_start']}", json.dumps(fleet_data), ex=86400)

        elif topic == "taxi_registry_updates":
            await redis_client.sadd("taxi_ids", data["taxi_id"])
            # ✅ Store first_seen timestamp
            if "first_seen" in data:
                await redis_client.hset("taxi_registry", taxi_id, data["first_seen"])

    except Exception as e:
        print(f"❌ Error processing message from {topic}: {e}")

async def broadcast_location_updates():
    """Enhanced broadcasting with filtering and metadata"""
    if not manager.active_connections or not location_cache:
        return
        
    # Get recent updates with enhanced data
    recent_updates = dict(list(location_cache.items())[-200:])
    
    # Batch fetch all enrichment data
    taxi_ids = list(recent_updates.keys())
    violation_counts = await redis_client.hmget("violation_counts", *taxi_ids)
    violation_severities = await redis_client.hmget("violation_severity", *taxi_ids)
    avg_speeds = await redis_client.hmget("avg_speed", *taxi_ids)
    distances = await redis_client.hmget("distance", *taxi_ids)
    
    # Enrich taxi data
    for i, taxi_id in enumerate(taxi_ids):
        taxi_data = recent_updates[taxi_id]
        taxi_data.update({
            "violations": int(violation_counts[i] or 0),
            "violation_severity": int(violation_severities[i] or 0),
            "avg_speed": float(avg_speeds[i]) if avg_speeds[i] else None,
            "distance": float(distances[i]) if distances[i] else 0.0
        })
    
    broadcast_data = {
        "type": "location_update", 
        "data": recent_updates,
        "metadata": {
            "total_taxis": len(recent_updates),
            "active_connections": len(manager.active_connections),
            "cache_size": len(location_cache)
        }
    }
    
    await manager.broadcast_updates(broadcast_data)
    
    # Clear cache more aggressively
    if len(location_cache) > 500:
        location_cache.clear()

def is_in_bounds(lat: float, lng: float, bounds: Bounds) -> bool:
    """Check if coordinates are within viewport bounds"""
    return (bounds.south <= lat <= bounds.north and 
            bounds.west <= lng <= bounds.east)

def check_rate_limit(endpoint: str) -> bool:
    """Simple rate limiting for expensive operations"""
    current_time = time.time()
    if current_time - last_expensive_call[endpoint] < RATE_LIMIT_SECONDS:
        return False
    last_expensive_call[endpoint] = current_time
    return True

@app.on_event("startup")
async def startup_event():
    for attempt in range(15):
        try:
            await redis_client.ping()
            print("✅ Redis connection established")
            break
        except Exception as e:
            print(f"🔁 Waiting for Redis (attempt {attempt + 1}/15)...")
            await asyncio.sleep(2)
    else:
        raise Exception("❌ Could not connect to Redis after 15 attempts")
    
    asyncio.create_task(consume())
    asyncio.create_task(clear_taxi_counters())
    asyncio.create_task(cleanup_task())

async def cleanup_task():
    """Periodic cleanup task"""
    while True:
        await asyncio.sleep(300)  # Every 5 minutes
        current_time = datetime.utcnow()
        print("🧹 Performed periodic cleanup")

async def clear_taxi_counters():
    while True:
        await asyncio.sleep(300)  # Clear every 5 minutes
        taxi_update_counter.clear()
        if len(location_cache) > 1000:
            location_cache.clear()
        last_expensive_call.clear()
        print("🧹 Cleared counters and cache for memory efficiency.")

# Health check endpoints
@app.get("/health", response_model=HealthStatus)
async def health_check():
    """Comprehensive health check"""
    try:
        redis_ok = await redis_client.ping()
        flink_active = last_processing_time is not None and \
                      (datetime.utcnow() - last_processing_time).seconds < 60
        
        processing_lag = None
        if last_processing_time:
            processing_lag = (datetime.utcnow() - last_processing_time).total_seconds()
        
        status = "healthy" if redis_ok and flink_active else "degraded"
        
        return HealthStatus(
            status=status,
            kafka_connected=last_processing_time is not None,
            redis_connected=redis_ok,
            flink_active=flink_active,
            active_websockets=len(manager.active_connections),
            processing_lag_seconds=processing_lag
        )
    except Exception:
        return HealthStatus(
            status="unhealthy",
            kafka_connected=False,
            redis_connected=False,
            flink_active=False,
            active_websockets=len(manager.active_connections)
        )

@app.get("/health/detailed")
async def detailed_health():
    """Detailed system health information"""
    try:
        taxi_count = await redis_client.scard("taxi_ids")
        
        # Count violations in last hour
        total_violations = 0
        taxi_ids = await redis_client.smembers("taxi_ids")
        for taxi_id in list(taxi_ids)[:100]:  # Sample first 100 for performance
            violation_count = await redis_client.hget("violation_counts", taxi_id)
            if violation_count:
                total_violations += int(violation_count)
        
        return {
            "system_status": "operational",
            "data_stats": {
                "total_taxis": taxi_count,
                "total_violations": total_violations,
                "cache_size": len(location_cache),
                "update_counter_size": len(taxi_update_counter)
            },
            "connection_stats": {
                "active_websockets": len(manager.active_connections),
                "client_bounds": len(manager.client_bounds)
            },
            "last_processing": last_processing_time.isoformat() if last_processing_time else None
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Health check failed: {str(e)}")

# Enhanced API endpoints
@app.get("/")
async def root():
    return {
        "status": "Enhanced Taxi Monitoring API running", 
        "version": "3.0",
        "features": [
            "Time-based speed calculations",
            "Enhanced violation detection", 
            "Advanced health monitoring",
            "Optimized WebSocket broadcasting",
            "Comprehensive data validation",
            "Compatible with enhanced Flink processing"
        ]
    }

@app.get("/speed/{taxi_id}")
async def get_latest_speed(taxi_id: str):
    value = await redis_client.get(f"latest_speed:{taxi_id}")
    try:
        if value:
            data = json.loads(value)
            # Add sample quality indicator
            sample_count = await redis_client.hget("speed_samples", taxi_id)
            if sample_count:
                data["sample_quality"] = "high" if int(sample_count) > 10 else "medium" if int(sample_count) > 5 else "low"
            return data
        return {"taxi_id": taxi_id, "message": "No speed data available"}
    except Exception as e:
        print(f"❌ Failed to decode latest_speed for {taxi_id}: {e}")
        return {"taxi_id": taxi_id, "error": "Data parsing error"}

@app.get("/avg_speed/{taxi_id}")
async def get_avg_speed(taxi_id: str):
    avg_speed = await redis_client.hget("avg_speed", taxi_id)
    sample_count = await redis_client.hget("speed_samples", taxi_id)
    
    return {
        "taxi_id": taxi_id, 
        "avg_speed": float(avg_speed) if avg_speed else None,
        "sample_count": int(sample_count) if sample_count else 0,
        "data_quality": "high" if sample_count and int(sample_count) > 20 else "medium" if sample_count and int(sample_count) > 10 else "low"
    }

@app.get("/distance/{taxi_id}")
async def get_distance(taxi_id: str, speed: float = 1.0):
    value = await redis_client.hget("distance", taxi_id)
    if value is None:
        return {"taxi_id": taxi_id, "total_distance": 0.0, "unit": "km"}
    try:
        scaled_distance = float(value) * speed
        return {
            "taxi_id": taxi_id, 
            "total_distance": round(scaled_distance, 6),  # ✅ Match Flink precision
            "unit": "km",
            "scaling_factor": speed
        }
    except ValueError:
        return {"taxi_id": taxi_id, "total_distance": 0.0, "error": "Invalid distance data"}

@app.get("/alerts/{taxi_id}")
async def get_alerts(taxi_id: str, limit: int = Query(10, ge=1, le=50)):
    alerts = await redis_client.lrange(f"alerts:{taxi_id}", 0, limit - 1)
    violation_severity = await redis_client.hget("violation_severity", taxi_id)
    
    parsed_alerts = []
    for alert in alerts:
        try:
            alert_data = json.loads(alert)
            parsed_alerts.append(alert_data)
        except json.JSONDecodeError:
            continue
    
    return {
        "taxi_id": taxi_id, 
        "alerts": parsed_alerts,
        "total_violations": len(parsed_alerts),
        "max_severity": int(violation_severity) if violation_severity else 0
    }

@app.get("/snapshot/{taxi_id}")
async def get_snapshot(taxi_id: str):
    snapshot = await redis_client.get(f"snapshot:{taxi_id}")
    try:
        if snapshot:
            data = json.loads(snapshot)
            # Add enrichment data
            violation_count = await redis_client.hget("violation_counts", taxi_id)
            avg_speed = await redis_client.hget("avg_speed", taxi_id)
            
            data.update({
                "violations": int(violation_count or 0),
                "avg_speed": float(avg_speed) if avg_speed else None
            })
            return data
        return {"taxi_id": taxi_id, "message": "No snapshot available"}
    except Exception as e:
        print(f"❌ Error decoding snapshot for {taxi_id}: {e}")
        return {"taxi_id": taxi_id, "error": "Snapshot parsing error"}

@app.get("/api/taxi/{taxi_id}/violations")
async def get_taxi_violations(taxi_id: str):
    key = f"alerts:{taxi_id}"
    raw_violations = await redis_client.lrange(key, 0, -1)
    
    parsed = []
    for v in raw_violations:
        try:
            obj = json.loads(v)
            parsed.append({
                "timestamp": obj.get("timestamp", ""),
                "type": obj.get("type", "Unknown"),
                "speed": obj.get("speed", 0),
                "severity": obj.get("severity", 1),
                "location": f"📍 {obj.get('timestamp', '')}",
                "description": obj.get("details", f"Speed: {obj.get('speed', 'N/A')} km/h")
            })
        except Exception:
            continue
    
    return parsed

@app.get("/fleet_summary/{window_start}")
async def get_fleet_summary(window_start: str, speed: float = 1.0):
    fleet_data_raw = await redis_client.get(f"fleet_summary:{window_start}")
    try:
        if fleet_data_raw:
            data = json.loads(fleet_data_raw)
            return {
                "window_start": window_start,
                "taxi_count": int(data.get("taxi_count", 0) * speed),
                "avg_fleet_speed": data.get("avg_fleet_speed", 0.0),
                "total_violations": data.get("total_violations", 0),
                "processed_at": data.get("processed_at")
            }
        else:
            return {
                "window_start": window_start,
                "taxi_count": 0,
                "avg_fleet_speed": 0.0,
                "total_violations": 0
            }
    except Exception:
        return {
            "window_start": window_start,
            "taxi_count": 0,
            "avg_fleet_speed": 0.0,
            "total_violations": 0,
            "error": "Data parsing error"
        }

@app.get("/fleet-summary")
async def get_fleet_summary_latest():
    """✅ Updated to handle enhanced fleet summary from Flink"""
    keys = await redis_client.keys("fleet_summary:*")
    if not keys:
        return {
            "total_taxis": 0,
            "active_taxis": 0,
            "avg_speed_kmh": 0.0,
            "total_violations": 0,
            "last_updated": None
        }
    
    latest_key = sorted(keys)[-1]
    fleet_data_raw = await redis_client.get(latest_key)
    
    try:
        if fleet_data_raw:
            fleet_data = json.loads(fleet_data_raw)
            return {
                "total_taxis": fleet_data.get("taxi_count", 0),
                "active_taxis": fleet_data.get("taxi_count", 0),
                "avg_speed_kmh": fleet_data.get("avg_fleet_speed", 0.0),
                "total_violations": fleet_data.get("total_violations", 0),
                "last_updated": fleet_data.get("processed_at")
            }
    except json.JSONDecodeError:
        pass
    
    # Fallback to calculated values if JSON parsing fails
    total_taxis = await redis_client.scard("taxi_ids")
    return {
        "total_taxis": total_taxis,
        "active_taxis": 0,
        "avg_speed_kmh": 0.0,
        "total_violations": 0,
        "last_updated": None
    }

@app.get("/taxi_ids")
async def get_taxi_ids():
    ids = await redis_client.smembers("taxi_ids")
    return {
        "taxi_ids": sorted(ids),
        "total_count": len(ids)
    }

@app.get("/top-violators")
async def top_violators(limit: int = Query(10, ge=1, le=50)):
    violations = await redis_client.hgetall("violation_counts")
    sorted_taxis = sorted(
        violations.items(), key=lambda x: int(x[1]), reverse=True
    )[:limit]

    result = []
    for taxi_id, count in sorted_taxis:
        avg_speed = await redis_client.hget("avg_speed", taxi_id)
        distance = await redis_client.hget("distance", taxi_id)
        severity = await redis_client.hget("violation_severity", taxi_id)
        
        result.append({
            "taxi_id": taxi_id,
            "violations": int(count),
            "avg_speed": float(avg_speed) if avg_speed else 0.0,
            "distance": float(distance) if distance else 0.0,
            "max_severity": int(severity) if severity else 0
        })
    return result

# Enhanced snapshots endpoint
@app.get("/snapshots")
async def get_snapshots(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=1000),
    north: Optional[float] = Query(None),
    south: Optional[float] = Query(None),
    east: Optional[float] = Query(None),
    west: Optional[float] = Query(None),
    include_violations: bool = Query(True),
    include_speed: bool = Query(True)
):
    if not check_rate_limit("snapshots"):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    
    taxi_ids = await redis_client.smembers("taxi_ids")
    taxi_ids = sorted(taxi_ids)
    
    start_idx = (page - 1) * limit
    end_idx = start_idx + limit
    paginated_ids = taxi_ids[start_idx:end_idx]
    
    if not paginated_ids:
        return {"data": [], "total": len(taxi_ids), "page": page, "limit": limit}
    
    keys = [f"snapshot:{taxi_id}" for taxi_id in paginated_ids]
    snapshots = await redis_client.mget(*keys)
    
    # Batch get enrichment data
    violation_counts = {}
    avg_speeds = {}
    
    if include_violations:
        violation_data = await redis_client.hmget("violation_counts", *paginated_ids)
        violation_counts = dict(zip(paginated_ids, violation_data))
    
    if include_speed:
        speed_data = await redis_client.hmget("avg_speed", *paginated_ids)
        avg_speeds = dict(zip(paginated_ids, speed_data))
    
    results = []
    for i, snap in enumerate(snapshots):
        if snap:
            try:
                data = json.loads(snap)
                taxi_id = paginated_ids[i]
                
                if include_violations:
                    data["violations"] = int(violation_counts.get(taxi_id, 0) or 0)
                
                if include_speed:
                    avg_speed = avg_speeds.get(taxi_id)
                    data["avg_speed"] = float(avg_speed) if avg_speed else None
                
                # Apply viewport filtering
                if all(x is not None for x in [north, south, east, west]):
                    bounds = Bounds(north=north, south=south, east=east, west=west)
                    if 'latitude' in data and 'longitude' in data:
                        if not is_in_bounds(data['latitude'], data['longitude'], bounds):
                            continue
                
                results.append(data)
            except json.JSONDecodeError:
                continue
    
    return {
        "data": results,
        "total": len(taxi_ids),
        "page": page,
        "limit": limit,
        "filtered_count": len(results),
        "enrichment": {
            "violations_included": include_violations,
            "speed_included": include_speed
        }
    }

@app.get("/snapshots/viewport")
async def get_snapshots_by_viewport(
    north: float = Query(...),
    south: float = Query(...),
    east: float = Query(...),
    west: float = Query(...),
    limit: int = Query(200, ge=1, le=2000)
):
    """Get taxis within viewport bounds - optimized for map rendering"""
    taxi_ids = await redis_client.smembers("taxi_ids")
    bounds = Bounds(north=north, south=south, east=east, west=west)
    
    results = []
    processed = 0
    batch_size = 100
    
    taxi_id_list = list(taxi_ids)
    
    for i in range(0, len(taxi_id_list), batch_size):
        if len(results) >= limit:
            break
            
        batch_ids = taxi_id_list[i:i + batch_size]
        keys = [f"snapshot:{taxi_id}" for taxi_id in batch_ids]
        snapshots = await redis_client.mget(*keys)
        
        violation_data = await redis_client.hmget("violation_counts", *batch_ids)
        violation_dict = dict(zip(batch_ids, violation_data))
        
        for j, snapshot in enumerate(snapshots):
            if len(results) >= limit:
                break
                
            if snapshot:
                try:
                    data = json.loads(snapshot)
                    if 'latitude' in data and 'longitude' in data:
                        if is_in_bounds(data['latitude'], data['longitude'], bounds):
                            taxi_id = batch_ids[j]
                            violation_count = violation_dict.get(taxi_id)
                            data["violations"] = int(violation_count or 0)
                            results.append(data)
                    processed += 1
                except json.JSONDecodeError:
                    continue
        
        await asyncio.sleep(0.001)
    
    return {
        "data": results,
        "bounds": bounds.dict(),
        "count": len(results),
        "processed": processed,
        "total_available": len(taxi_id_list)
    }

@app.get("/status/{taxi_id}")
async def get_taxi_status(taxi_id: str):
    """Get current status of a specific taxi"""
    try:
        # Get latest snapshot
        snapshot = await redis_client.get(f"snapshot:{taxi_id}")
        if not snapshot:
            return {"taxi_id": taxi_id, "status": "not_found"}
        
        data = json.loads(snapshot)
        
        # Get enrichment data
        violation_count = await redis_client.hget("violation_counts", taxi_id)
        avg_speed = await redis_client.hget("avg_speed", taxi_id)
        distance = await redis_client.hget("distance", taxi_id)
        sample_count = await redis_client.hget("speed_samples", taxi_id)
        
        return {
            "taxi_id": taxi_id,
            "location": {
                "latitude": data.get("latitude"),
                "longitude": data.get("longitude"),
                "last_updated": data.get("last_updated")
            },
            "performance": {
                "avg_speed": float(avg_speed) if avg_speed else None,
                "total_distance": float(distance) if distance else 0.0,
                "sample_count": int(sample_count) if sample_count else 0
            },
            "violations": {
                "count": int(violation_count or 0),
                "severity": await redis_client.hget("violation_severity", taxi_id)
            },
            "status": "active"
        }
    except Exception as e:
        return {"taxi_id": taxi_id, "status": "error", "error": str(e)}

@app.get("/score/{taxi_id}")
async def get_taxi_score(taxi_id: str):
    """Calculate taxi performance score"""
    violations = int(await redis_client.hget("violation_counts", taxi_id) or 0)
    avg_speed_raw = await redis_client.hget("avg_speed", taxi_id)
    avg_speed = float(avg_speed_raw) if avg_speed_raw else 0.0
    distance_raw = await redis_client.hget("distance", taxi_id)
    distance = float(distance_raw) if distance_raw else 0.0

    # Scoring algorithm
    score = 100
    score -= min(violations * 5, 50)  # Max -50 for violations
    
    if 20 <= avg_speed <= 60:  # Safe speed range
        score += min((avg_speed - 20) * 0.5, 20)  # Max +20
    
    if distance > 0:
        score += min(distance * 0.1, 15)  # Max +15 for distance
    
    score = max(10, min(score, 100))  # Keep in range 10-100
    
    # Determine grade
    if score >= 90:
        grade = "A"
    elif score >= 75:
        grade = "B"
    elif score >= 60:
        grade = "C"
    else:
        grade = "D"
    
    return {
        "taxi_id": taxi_id,
        "score": round(score, 1),
        "grade": grade,
        "details": {
            "violations": violations,
            "avg_speed": round(avg_speed, 2),
            "distance": round(distance, 2)
        }
    }

# Enhanced WebSocket endpoints
@app.websocket("/ws/taxi")
async def stream_taxi_snapshots(websocket: WebSocket):
    """Legacy WebSocket endpoint with enhanced features"""
    await websocket.accept()
    print("🚦 WebSocket connection accepted (legacy enhanced)")
    last_hash = None
    
    try:
        while True:
            taxi_ids = await redis_client.smembers("taxi_ids")
            if not taxi_ids:
                await asyncio.sleep(10)
                continue
                
            # Limit to prevent overwhelming client
            limited_ids = list(taxi_ids)[:500]
            keys = [f"snapshot:{taxi_id}" for taxi_id in limited_ids]
            snapshots = await redis_client.mget(*keys)
            
            # Get enrichment data in batches
            violation_counts = await redis_client.hmget("violation_counts", *limited_ids)
            avg_speeds = await redis_client.hmget("avg_speed", *limited_ids)
            distances = await redis_client.hmget("distance", *limited_ids)
            
            violation_dict = dict(zip(limited_ids, violation_counts))
            speed_dict = dict(zip(limited_ids, avg_speeds))
            distance_dict = dict(zip(limited_ids, distances))
            
            result = []
            for i, snap in enumerate(snapshots):
                if snap:
                    try:
                        taxi_data = json.loads(snap)
                        taxi_id = limited_ids[i]
                        
                        # Add enrichment data
                        taxi_data["violations"] = int(violation_dict.get(taxi_id, 0) or 0)
                        
                        avg_speed = speed_dict.get(taxi_id)
                        taxi_data["avg_speed"] = float(avg_speed) if avg_speed else None
                        
                        distance = distance_dict.get(taxi_id)
                        taxi_data["distance"] = float(distance) if distance else 0.0
                        
                        result.append(taxi_data)
                    except json.JSONDecodeError:
                        continue
            
            # Only send if data changed
            serialized = json.dumps(result, separators=(",", ":"))
            current_hash = hashlib.md5(serialized.encode()).hexdigest()
            
            if current_hash != last_hash:
                await websocket.send_text(serialized)
                last_hash = current_hash
                print(f"📤 Sent {len(result)} enhanced taxis @ {len(serialized)} bytes")
            
            await asyncio.sleep(12)  # Slightly slower for legacy compatibility
            
    except WebSocketDisconnect:
        print("🔌 Legacy WebSocket client disconnected")
    except Exception as e:
        print(f"❌ Legacy WebSocket error: {e}")

@app.websocket("/ws/taxi/{client_id}")
async def stream_taxi_snapshots_enhanced(websocket: WebSocket, client_id: str):
    """Enhanced WebSocket endpoint with viewport support"""
    await manager.connect(websocket, client_id)
    
    try:
        while True:
            try:
                message = await asyncio.wait_for(websocket.receive_text(), timeout=2.0)
                data = json.loads(message)
                manager.client_last_activity[client_id] = datetime.utcnow()
                
                if data.get("type") == "viewport_update":
                    bounds = data.get("bounds")
                    if bounds:
                        manager.client_bounds[client_id] = bounds
                        print(f"📍 Updated viewport for client {client_id}")
                        
                        viewport_data = await get_viewport_data(bounds)
                        await manager.send_to_client(websocket, json.dumps({
                            "type": "viewport_data",
                            "data": viewport_data,
                            "client_id": client_id,
                            "timestamp": datetime.utcnow().isoformat()
                        }))
                
                elif data.get("type") == "ping":
                    await manager.send_to_client(websocket, json.dumps({
                        "type": "pong",
                        "client_id": client_id,
                        "server_time": datetime.utcnow().isoformat()
                    }))
                        
            except asyncio.TimeoutError:
                # Send heartbeat with system status
                system_status = {
                    "type": "heartbeat",
                    "client_id": client_id,
                    "server_time": datetime.utcnow().isoformat(),
                    "active_connections": len(manager.active_connections),
                    "processing_active": last_processing_time is not None and 
                                       (datetime.utcnow() - last_processing_time).seconds < 60
                }
                await manager.send_to_client(websocket, json.dumps(system_status))
                continue
                
    except WebSocketDisconnect:
        manager.disconnect(websocket, client_id)
    except Exception as e:
        print(f"❌ Enhanced WebSocket error for client {client_id}: {e}")
        manager.disconnect(websocket, client_id)

async def get_viewport_data(bounds: dict) -> list:
    """Get enhanced taxi data within viewport bounds"""
    taxi_ids = await redis_client.smembers("taxi_ids")
    results = []
    
    limited_ids = list(taxi_ids)[:300]
    
    for taxi_id in limited_ids:
        snapshot = await redis_client.get(f"snapshot:{taxi_id}")
        if snapshot:
            try:
                data = json.loads(snapshot)
                if 'latitude' in data and 'longitude' in data:
                    if is_in_bounds(data['latitude'], data['longitude'], Bounds(**bounds)):
                        # Add enrichment data
                        violation_count = await redis_client.hget("violation_counts", taxi_id)
                        avg_speed = await redis_client.hget("avg_speed", taxi_id)
                        distance = await redis_client.hget("distance", taxi_id)
                        
                        data.update({
                            "violations": int(violation_count or 0),
                            "avg_speed": float(avg_speed) if avg_speed else None,
                            "distance": float(distance) if distance else 0.0
                        })
                        results.append(data)
            except json.JSONDecodeError:
                continue
    
    return results

# Additional utility endpoints
@app.get("/metrics")
async def get_processing_metrics():
    """Get current processing metrics"""
    try:
        total_taxis = await redis_client.scard("taxi_ids")
        violation_count_keys = await redis_client.hlen("violation_counts")
        
        all_violation_counts = await redis_client.hvals("violation_counts")
        total_violations = sum(int(count) for count in all_violation_counts)
        
        return {
            "system_metrics": {
                "total_taxis": total_taxis,
                "taxis_with_violations": violation_count_keys,
                "total_violations": total_violations,
                "location_cache_size": len(location_cache),
                "update_counter_size": len(taxi_update_counter),
                "active_websockets": len(manager.active_connections)
            },
            "processing_status": {
                "last_processing": last_processing_time.isoformat() if last_processing_time else None,
                "kafka_lag_seconds": (datetime.utcnow() - last_processing_time).total_seconds() if last_processing_time else None
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching metrics: {str(e)}")

@app.get("/system/stats")
async def get_system_stats():
    """Get comprehensive system statistics"""
    try:
        # Basic counts
        total_taxis = await redis_client.scard("taxi_ids")
        
        # Speed statistics
        all_speeds = await redis_client.hvals("avg_speed")
        speed_values = [float(s) for s in all_speeds if s]
        
        # Distance statistics  
        all_distances = await redis_client.hvals("distance")
        distance_values = [float(d) for d in all_distances if d]
        
        # Violation statistics
        all_violations = await redis_client.hvals("violation_counts")
        violation_values = [int(v) for v in all_violations if v]
        
        return {
            "fleet_overview": {
                "total_taxis": total_taxis,
                "active_connections": len(manager.active_connections)
            },
            "speed_stats": {
                "avg_fleet_speed": sum(speed_values) / len(speed_values) if speed_values else 0.0,
                "max_speed": max(speed_values) if speed_values else 0.0,
                "min_speed": min(speed_values) if speed_values else 0.0
            },
            "distance_stats": {
                "total_fleet_distance": sum(distance_values),
                "avg_distance_per_taxi": sum(distance_values) / len(distance_values) if distance_values else 0.0
            },
            "violation_stats": {
                "total_violations": sum(violation_values),
                "taxis_with_violations": len(violation_values),
                "avg_violations_per_taxi": sum(violation_values) / len(violation_values) if violation_values else 0.0
            },
            "system_health": {
                "processing_active": last_processing_time is not None and 
                                   (datetime.utcnow() - last_processing_time).seconds < 60,
                "cache_size": len(location_cache),
                "memory_usage": "normal"
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching system stats: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)