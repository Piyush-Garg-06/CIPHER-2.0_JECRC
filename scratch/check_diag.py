from api.cohort_v2_store import CohortStore
from api.db import Database
from api.simulator import WearableStreamSimulator
from data_gen.cohort_v2 import generate_synthetic_cohort
import numpy as np

# Check default CohortStore
db = Database(':memory:')
store = CohortStore(num_patients=200, days_count=60, seed=42, db_instance=db)
sim = WearableStreamSimulator(store=store, db_instance=db)
sim._init_sim_state()
status = sim.get_status()
print("Seed 42 (200, 60) status:", status)

for pid, p in store.patient_map.items():
    last_day = p['daily_readings'][-1]['day'] if p['daily_readings'] else 0
    if last_day >= store.days_count:
        print("Default store >= 60:", pid, "last stored day:", last_day, "days_count:", store.days_count)

# Check raw cohort generation with as_of_day logic
rng_as_of = np.random.default_rng(42 + 1000)
raw = generate_synthetic_cohort(200, 60, 42)
for p in raw:
    as_of = int(rng_as_of.integers(14, 60 + 1))
    if as_of == 60:
        print("Raw as_of == 60:", p['id'], "event_day:", p.get('event_day'), "has_event:", p.get('has_event'))

# Check seed 1 or num_patients 20 or days_count 50 or other seeds
for seed in [1, 42, 123]:
    store_s = CohortStore(num_patients=200, days_count=60, seed=seed, db_instance=Database(':memory:'))
    sim_s = WearableStreamSimulator(store=store_s, db_instance=store_s.db)
    sim_s._init_sim_state()
    st = sim_s.get_status()
    if st['patientsExhausted'] > 0:
        print(f"Seed {seed} status: {st}")
        sim_state = store_s.db.get_sim_state()
        for pid in store_s.patient_map:
            if sim_state.get(pid, 1) > store_s.days_count:
                print(f"Seed {seed} exhausted at startup: {pid}, last stored day: {store_s.patient_map[pid]['daily_readings'][-1]['day']}, days_count: {store_s.days_count}")
