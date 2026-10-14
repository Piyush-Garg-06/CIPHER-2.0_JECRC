import sys
import os
sys.path.insert(0, r"c:\Users\prash\Downloads\medical1\medical")
from api.cohort_v2_store import CohortStore
from api.db import Database
from api.simulator import WearableStreamSimulator
from collections import Counter, defaultdict

db = Database(":memory:")
store = CohortStore(db_instance=db)
sim = WearableStreamSimulator(store=store, db_instance=db)
sim._init_sim_state()

# Run until stream is fully exhausted
tick_count = 0
while sim.get_status()["patientsActive"] > 0 and tick_count < 250:
    sim.tick()
    tick_count += 1

print(f"Stream exhausted after {tick_count} ticks.")
print("Final sim status:", sim.get_status())

# For all 177 patients:
# Check trailing missing days (>= 3 days with no reading at the end)
# days_count = 60
# A trailing gap is: at the end of the trajectory up to day 60, how many days have resting_hr is None or missing?
# Or trailing missing days in daily_readings:
# Look at daily_readings[-1], daily_readings[-2], etc.
results = []
cross_tab = defaultdict(lambda: {"total": 0, "trailing_gap_ge_3": 0, "no_trailing_gap": 0})

for pid, p in sorted(store.patient_map.items()):
    readings = p.get("daily_readings", [])
    tw = store.compute_twin(pid)
    zone = tw.get("triageZone", "green")
    watch = tw.get("watch", False)
    red_source = tw.get("redSource")
    
    if zone == "red":
        if red_source == "symptom":
            cat = "red-symptom"
        elif red_source == "both":
            cat = "red-both"
        else:
            cat = "red-model"
    elif zone == "yellow":
        cat = "yellow"
    elif watch:
        cat = "watch"
    else:
        cat = "green"

    # Count trailing missing days:
    # 1. Total days up to days_count (60)
    # Readings in store: each reading has a 'day'. Missing days might have resting_hr == None, or day not present up to 60.
    # Let's check from day 60 backwards, or from the end of readings list backwards:
    # Check valid days with resting_hr != None
    valid_days = [r["day"] for r in readings if r.get("resting_hr") is not None]
    max_valid_day = max(valid_days) if valid_days else 0
    max_day_recorded = max((r["day"] for r in readings), default=0)
    
    # Trailing missing days at the end:
    # Either relative to days_count (60 - max_valid_day) or relative to max_day_recorded
    # In cohort_v2: "6. Stop generating readings after event_day (no data after the event)"
    # n_days = event_day if has_event else days_count
    # So if n_days < 60, readings stop after n_days!
    # Trailing gap to day 60: 60 - max_valid_day
    trailing_gap_to_60 = 60 - max_valid_day
    
    # Also trailing consecutive None readings at the end of readings list:
    trailing_nones = 0
    for r in reversed(readings):
        if r.get("resting_hr") is None:
            trailing_nones += 1
        else:
            break
            
    has_gap = (trailing_gap_to_60 >= 3)
    
    cross_tab[cat]["total"] += 1
    if has_gap:
        cross_tab[cat]["trailing_gap_ge_3"] += 1
    else:
        cross_tab[cat]["no_trailing_gap"] += 1
        
    results.append({
        "pid": pid,
        "cat": cat,
        "max_valid_day": max_valid_day,
        "max_day_recorded": max_day_recorded,
        "trailing_gap_to_60": trailing_gap_to_60,
        "trailing_nones": trailing_nones
    })

print("\n=== CROSS-TABULATION (Trailing missing days >= 3 relative to day 60) ===")
print(f"{'Final Zone':<15} | {'Total':<6} | {'>= 3 Missing Days':<18} | {'< 3 Missing Days':<18} | {'% with Gap':<10}")
print("-" * 75)
for cat in ["green", "watch", "yellow", "red-model", "red-symptom", "red-both"]:
    if cat in cross_tab:
        t = cross_tab[cat]["total"]
        g = cross_tab[cat]["trailing_gap_ge_3"]
        ng = cross_tab[cat]["no_trailing_gap"]
        pct = (g / t * 100) if t > 0 else 0
        print(f"{cat:<15} | {t:<6} | {g:<18} | {ng:<18} | {pct:<9.1f}%")

print("\nTotal patients:", len(results))
total_with_gap = sum(1 for r in results if r["trailing_gap_to_60"] >= 3)
print(f"Total patients with trailing gap >= 3: {total_with_gap} / 177 ({total_with_gap/177*100:.1f}%)")
