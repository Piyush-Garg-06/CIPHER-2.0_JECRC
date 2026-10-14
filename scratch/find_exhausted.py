import sys
sys.path.insert(0, r"c:\Users\prash\Downloads\medical1\medical")
from api.cohort_v2_store import CohortStore
from api.db import Database
from api.simulator import WearableStreamSimulator

# Check standard seed 42 with different configurations
for n in [200, 100, 50, 20, 15, 10]:
    for d in [60, 50, 40, 30, 20]:
        store = CohortStore(num_patients=n, days_count=d, seed=42, db_instance=Database(":memory:"))
        exhausted = []
        for pid, p in store.patient_map.items():
            max_d = max(r["day"] for r in p["daily_readings"])
            if max_d == d:
                exhausted.append((pid, max_d, d))
        if exhausted:
            print(f"num_patients={n}, days_count={d}: exhausted at startup={exhausted}")

# Also check seed 0, 1, 42, 1000, 1234
for s in [0, 1, 2, 3, 4, 5, 42, 100, 1234]:
    store = CohortStore(num_patients=200, days_count=60, seed=s, db_instance=Database(":memory:"))
    exhausted = []
    for pid, p in store.patient_map.items():
        max_d = max(r["day"] for r in p["daily_readings"])
        if max_d == 60:
            exhausted.append((pid, max_d, 60))
    if exhausted:
        print(f"seed={s}, days_count=60: exhausted at startup={exhausted}")
