import json
import random
from datetime import datetime, timedelta

def generate_incidents():
    incidents = []
    engineers = ["priya", "sahil", "alex", "jordan", "taylor"]
    
    # Base timestamp 3 months ago
    base_time = datetime(2026, 4, 1, 10, 0, 0)
    
    # 5 Families
    # 1. DB connection pool exhaustion
    for i in range(6):
        t = base_time + timedelta(days=random.randint(1, 80), hours=random.randint(0, 23))
        incidents.append({
            "id": f"inc-{1000+len(incidents)}",
            "timestamp": t.isoformat() + "Z",
            "service": random.choice(["checkout-service", "payments-service"]),
            "alert_title": "p99 latency > 3000ms",
            "raw_logs": [
                f"[{t.strftime('%Y-%m-%d %H:%M:%S')}] ERROR: Database connection timeout after 30000ms",
                f"[{t.strftime('%Y-%m-%d %H:%M:%S')}] ERROR: Connection pool exhausted (active=50, max=50)",
                f"[{t.strftime('%Y-%m-%d %H:%M:%S')}] WARN: Retry attempt 3/3 failed",
                "Stack trace: at db.pool.acquire (pool.js:142)"
            ],
            "root_cause": "Connection pool exhausted after a deploy increased concurrent workers without raising DB_POOL_MAX",
            "resolution": "Increased DB_POOL_MAX from 20 to 50 and restarted the connection pool",
            "resolved_by": random.choice(engineers),
            "resolution_time_minutes": random.randint(10, 30),
            "severity": "high",
            "tags": ["database", "connection-pool", "latency"],
            "sensitive": random.choice([True, False]) # making some sensitive
        })
        
    # 2. Redis connection failures
    for i in range(6):
        t = base_time + timedelta(days=random.randint(1, 80), hours=random.randint(0, 23))
        incidents.append({
            "id": f"inc-{1000+len(incidents)}",
            "timestamp": t.isoformat() + "Z",
            "service": "session-service",
            "alert_title": "High rate of 500 errors in session-service",
            "raw_logs": [
                f"[{t.strftime('%Y-%m-%d %H:%M:%S')}] ERROR: Redis connection failed: ECONNREFUSED",
                f"[{t.strftime('%Y-%m-%d %H:%M:%S')}] ERROR: Failed to read session data for user req_id=99283",
                "Stack trace: at RedisClient.connect (redis.js:45)"
            ],
            "root_cause": "Redis node underwent an unexpected restart and client did not reconnect properly",
            "resolution": "Updated redis client config to enable auto-reconnect and restarted session-service",
            "resolved_by": random.choice(engineers),
            "resolution_time_minutes": random.randint(5, 15),
            "severity": "medium",
            "tags": ["redis", "session", "cache"],
            "sensitive": random.choice([True, False])
        })
        
    # 3. Memory leaks / OOM kills
    for i in range(6):
        t = base_time + timedelta(days=random.randint(1, 80), hours=random.randint(0, 23))
        incidents.append({
            "id": f"inc-{1000+len(incidents)}",
            "timestamp": t.isoformat() + "Z",
            "service": random.choice(["worker-service", "data-pipeline"]),
            "alert_title": "Container restart loop (OOMKilled)",
            "raw_logs": [
                f"[{t.strftime('%Y-%m-%d %H:%M:%S')}] WARN: Memory usage at 95% (limit: 2Gi)",
                f"[{t.strftime('%Y-%m-%d %H:%M:%S')}] FATAL: Allocation failed - process out of memory",
                "kernel: [1234.56] Out of memory: Killed process 42 (node) total-vm:2560000kB"
            ],
            "root_cause": "Memory leak in data parsing loop accumulating unreferenced objects over time",
            "resolution": "Rolled back recent deploy containing the memory leak and scaled up instances temporarily",
            "resolved_by": random.choice(engineers),
            "resolution_time_minutes": random.randint(20, 60),
            "severity": "high",
            "tags": ["memory", "oom", "kubernetes"],
            "sensitive": False
        })
        
    # 4. Failed deploy / bad config rollout
    for i in range(6):
        t = base_time + timedelta(days=random.randint(1, 80), hours=random.randint(0, 23))
        incidents.append({
            "id": f"inc-{1000+len(incidents)}",
            "timestamp": t.isoformat() + "Z",
            "service": random.choice(["api-gateway", "frontend"]),
            "alert_title": "Service availability dropped below 99%",
            "raw_logs": [
                f"[{t.strftime('%Y-%m-%d %H:%M:%S')}] INFO: Starting service with config version v2.1.0",
                f"[{t.strftime('%Y-%m-%d %H:%M:%S')}] FATAL: Missing required environment variable STRIPE_SECRET_KEY",
                "Stack trace: at ConfigLoader.validate (config.ts:88)",
                f"[{t.strftime('%Y-%m-%d %H:%M:%S')}] ERROR: Application failed to start"
            ],
            "root_cause": "New environment variable requirement introduced in latest release without updating the Helm chart",
            "resolution": "Rolled back deployment to previous stable version and added missing env var to staging/prod secrets",
            "resolved_by": random.choice(engineers),
            "resolution_time_minutes": random.randint(4, 12),
            "severity": "critical",
            "tags": ["deploy", "config", "downtime"],
            "sensitive": random.choice([True, False])
        })
        
    # 5. Slow-burn incident: CPU creeping up over 20-30 min
    for i in range(6):
        t = base_time + timedelta(days=random.randint(1, 80), hours=random.randint(0, 23))
        incidents.append({
            "id": f"inc-{1000+len(incidents)}",
            "timestamp": t.isoformat() + "Z",
            "service": "image-processing",
            "alert_title": "CPU utilization > 90% for 15m",
            "raw_logs": [
                f"[{t.strftime('%Y-%m-%d %H:%M:%S')}] WARN: Image resize operation taking > 5000ms",
                f"[{t.strftime('%Y-%m-%d %H:%M:%S')}] WARN: Event loop blocked for 2000ms",
                f"[{t.strftime('%Y-%m-%d %H:%M:%S')}] ERROR: Healthcheck failed - worker unresponsive",
                "Stack trace: at sharp.resize (worker.js:22)"
            ],
            "root_cause": "A malformed batch of highly compressed images caused the resizing library to enter an expensive infinite loop",
            "resolution": "Added timeouts to the resize operations and deployed hotfix to reject malformed image headers",
            "resolved_by": random.choice(engineers),
            "resolution_time_minutes": random.randint(45, 90),
            "severity": "high",
            "tags": ["cpu", "performance", "image-processing"],
            "sensitive": False
        })
        
    # Sort chronologically
    incidents.sort(key=lambda x: x["timestamp"])
    
    # Ensure sensitive count
    sensitive_count = sum(1 for inc in incidents if inc.get("sensitive"))
    
    with open("data/incidents.json", "w") as f:
        json.dump(incidents, f, indent=2)
        
    print(f"Generated {len(incidents)} incidents. Sensitive count: {sensitive_count}")

if __name__ == "__main__":
    generate_incidents()
