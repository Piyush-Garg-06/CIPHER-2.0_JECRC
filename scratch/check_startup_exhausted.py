import sys
sys.path.insert(0, r"c:\Users\prash\Downloads\medical1\medical")
from data_gen.cohort_v2 import generate_synthetic_cohort
import numpy as np

cohort = generate_synthetic_cohort(200, 60, seed=42)
rng = np.random.default_rng(42 + 1000)
for p in cohort:
    ev = p.get('event_day')
    as_of = int(rng.integers(10, 61))
    if ev is not None and ev <= as_of:
        continue
    days = [r['day'] for r in p['daily_readings'] if r['day'] <= as_of]
    max_d = max(days) if days else 0
    if max_d >= 58:
        print(f"Patient {p['id']}: as_of={as_of}, ev={ev}, max_d={max_d}")
