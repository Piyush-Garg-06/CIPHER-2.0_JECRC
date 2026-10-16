# Risk Forecaster Model Evaluation Report

## Overview
Evaluation performed on a 2,000-patient synthetic cohort split patient-wise (60% Train, 20% Calibration, 20% Test).
The test split was not used for any model tuning, feature selection, or cutoff threshold determination.

## Split Sizes
- Train: 1199 patients (293 events), 51297 rows (prevalence: 3.67%)
- Calibration: 399 patients (97 events), 17255 rows (prevalence: 3.61%)
- Test: 402 patients (99 events), 17182 rows (prevalence: 3.71%)

## Test Benchmark at Matched Alert Burden

Burden targets calibrated on calibration split: Yellow target ~3.0 alert-days / 100 pt-days; Red target ~0.5 alert-days / 100 pt-days.
Alerts evaluated using the 2-consecutive-day rule. Catches evaluated strictly within [event_day - 7, event_day - 1].
95% confidence intervals computed via 1,000 patient-level paired bootstrap resamples on the test split.

| Metric | (a) Simple HR Rule | (b) Logistic Model | (c) Gradient Boosting |
|---|---|---|---|
| ROC-AUC | 0.6683 (95% CI: [0.6187, 0.7156]) | 0.7096 (95% CI: [0.6641, 0.7535]) | 0.7123 (95% CI: [0.6606, 0.7631]) |
| PR-AUC (Random: 0.0371) | 0.1337 (95% CI: [0.1018, 0.1731]) | 0.3465 (95% CI: [0.2793, 0.4239]) | 0.3647 (95% CI: [0.2931, 0.4417]) |
| Brier Score | N/A | 0.0286 (95% CI: [0.0233, 0.0341]) | 0.0277 (95% CI: [0.0226, 0.0329]) |
| Brier Skill Score | N/A | 0.1993 (95% CI: [0.1391, 0.2629]) | 0.2251 (95% CI: [0.1580, 0.2961]) |
| Yellow Cutoff (Calib) | +2.67 bpm | 0.046864 | 0.039093 |
| Yellow Catch Rate | 57.6% (95% CI: [48.2%, 67.0%]) | 64.7% (95% CI: [55.3%, 74.4%]) | 62.6% (95% CI: [52.8%, 72.1%]) |
| Yellow Median Lead Time | 3.0 days (95% CI: [3.0, 4.0]) | 3.0 days (95% CI: [3.0, 4.0]) | 3.0 days (95% CI: [3.0, 5.0]) |
| Yellow Alert-days / 100 pt-days | 2.51 (95% CI: [1.97, 3.07]) | 2.69 (95% CI: [2.11, 3.43]) | 3.13 (95% CI: [2.15, 4.35]) |
| Yellow % Event-free w/ Alert | 34.0% (95% CI: [28.7%, 39.2%]) | 36.0% (95% CI: [31.2%, 41.8%]) | 33.7% (95% CI: [28.5%, 39.3%]) |
| Yellow Episodes / pt-month | 0.48 (95% CI: [0.40, 0.57]) | 0.45 (95% CI: [0.37, 0.53]) | 0.36 (95% CI: [0.29, 0.44]) |
| Red Cutoff (Calib) | +5.00 bpm | 0.231728 | 0.288831 |
| Red Catch Rate | 50.5% (95% CI: [41.0%, 60.0%]) | 53.5% (95% CI: [43.7%, 63.6%]) | 55.6% (95% CI: [45.8%, 65.5%]) |
| Red Median Lead Time | 2.0 days (95% CI: [2.0, 3.0]) | 3.0 days (95% CI: [2.0, 3.5]) | 3.0 days (95% CI: [2.0, 4.0]) |
| Red Alert-days / 100 pt-days | 0.40 (95% CI: [0.26, 0.57]) | 0.39 (95% CI: [0.26, 0.53]) | 0.39 (95% CI: [0.25, 0.54]) |
| Red % Event-free w/ Alert | 9.9% (95% CI: [6.7%, 13.4%]) | 10.2% (95% CI: [7.0%, 13.8%]) | 10.2% (95% CI: [7.0%, 13.9%]) |
| Red Episodes / pt-month | 0.06 (95% CI: [0.04, 0.08]) | 0.06 (95% CI: [0.04, 0.08]) | 0.06 (95% CI: [0.04, 0.08]) |

## Differences (paired)

Paired bootstrap (1,000 resamples of TEST patients with fixed seed=123).

| Metric | LR minus Simple HR Rule (Mean [95% CI]) | LR minus Gradient Boosting (Mean [95% CI]) |
|---|---|---|
| ROC-AUC | +0.0414 (95% CI: [+0.0038, +0.0792]) | -0.0023 (95% CI: [-0.0318, +0.0280]) |
| PR-AUC | +0.2125 (95% CI: [+0.1647, +0.2629]) | -0.0180 (95% CI: [-0.0391, +0.0032]) |
| Yellow Catch Rate (%) | +7.0% (95% CI: [+0.0%, +14.4%]) | +2.1% (95% CI: [-2.9%, +7.3%]) |
| Red Catch Rate (%) | +3.1% (95% CI: [-1.1%, +7.7%]) | -2.0% (95% CI: [-5.1%, +0.0%]) |
| Yellow Alert-days / 100 pt-days | +0.20 (95% CI: [-0.52, +1.02]) | -0.42 (95% CI: [-1.66, +0.64]) |
| Red Alert-days / 100 pt-days | -0.01 (95% CI: [-0.12, +0.08]) | +0.00 (95% CI: [-0.08, +0.08]) |

*Statistical interpretation rule*: A difference is described as "better" or "higher" only when the paired 95% confidence interval strictly excludes 0; otherwise the models are described as "not distinguishable".
- LR vs Simple HR Rule: ROC-AUC and PR-AUC are higher for the Logistic Model (paired 95% CIs exclude 0). Yellow Catch Rate, Red Catch Rate, Yellow Alert-days, and Red Alert-days are not distinguishable (paired 95% CIs include 0).
- LR vs Gradient Boosting: ROC-AUC, PR-AUC, Yellow Catch Rate, Red Catch Rate, Yellow Alert-days, and Red Alert-days are not distinguishable (all paired 95% CIs include 0).

## Acute Symptom-Triggered Red Alerts (Logistic Model)

The rule in twin/zones.py immediately elevates any patient with an acute red-flag symptom (`chest_pain`, `syncope`, `acute_dyspnea`) to Red triage without requiring 2 consecutive nights of elevated scores. The symptom alert remains active for the 3 days after the symptom is recorded ([t-3, t]).

| Variant | Catch Rate (7d window) | Median Lead Time | Alert-days / 100 pt-days | % Event-free w/ Alert | Episodes / pt-month |
|---|---|---|---|---|---|
| (1) Model-only Red (2-day consecutive >= 0.231728) | 53.54% | 3.0 days | 0.39 | 10.23% | 0.06 |
| (2) Symptom-only Red (acute red flag in [t-3, t]) | 25.25% | 1.0 days | 0.83 | 9.90% | 0.07 |
| (3) Combined Red (Either Model or Symptom) | 65.66% | 2.0 days | 1.15 | 17.49% | 0.11 |

## Episode-Level Precision (TEST Split)

An episode is a run of consecutive alert days for a single patient. An episode is true if at least one of its days falls within [event_day - 7, event_day - 1].

| Alert Policy | Total Episodes | True Episodes | Precision (%) | False Alarms per True Catch |
|---|---|---|---|---|
| Yellow (Yellow or Red, model rule) | 313 | 72 | 23.00% | 3.35 |
| Model-only Red | 92 | 58 | 63.04% | 0.59 |
| Symptom-only Red | 66 | 25 | 37.88% | 1.64 |
| Combined Red | 137 | 70 | 51.09% | 0.96 |

## Calibration Analysis (Logistic Model)

- Mean predicted probability on TEST is 0.0307 compared to an observed event rate of 0.0371.
- Expected Calibration Error (ECE, 10 equal-count bins) is 0.0123 (33.2% of the base event rate).
- Predicted range below the yellow cutoff (0.046864): 5 of the 10 calibration bins observe more than 2x the predicted rate, with observed-to-predicted ratios ranging from 0.72x to 5.33x.
- High-risk segments (segments 1, 2, 3, 5) where predicted exceeds observed: predicted-to-observed ratios range from 1.02x to 1.68x.
- The lowest predicted value from which every higher high-risk segment has |pred - obs| / obs <= 0.25 is 9.4% (Segment 4: |0.1429 - 0.1429| / 0.1429 = 0.0000).
- Show zones; show percentages as approximate.
- Segments with fewer than 30 events are suggestive, not established.

### 10-Bin Test Calibration Table

| Bin | Predicted Range | Count | Events | Mean Predicted | Actual Fraction | 95% Wilson CI | |Pred - Obs| |
|---|---|---|---|---|---|---|---|
| 1 | [0.0003, 0.0036] | 1719 | 22 | 0.0024 | 0.0128 | [0.0085, 0.0193] | 0.0104 |
| 2 | [0.0036, 0.0056] | 1718 | 34 | 0.0046 | 0.0198 | [0.0142, 0.0275] | 0.0152 |
| 3 | [0.0056, 0.0076] | 1718 | 48 | 0.0066 | 0.0279 | [0.0211, 0.0368] | 0.0214 |
| 4 | [0.0076, 0.0096] | 1718 | 43 | 0.0086 | 0.0250 | [0.0186, 0.0335] | 0.0165 |
| 5 | [0.0096, 0.0121] | 1718 | 41 | 0.0108 | 0.0239 | [0.0176, 0.0322] | 0.0130 |
| 6 | [0.0121, 0.0154] | 1718 | 47 | 0.0137 | 0.0274 | [0.0206, 0.0362] | 0.0137 |
| 7 | [0.0154, 0.0201] | 1718 | 36 | 0.0175 | 0.0210 | [0.0152, 0.0289] | 0.0034 |
| 8 | [0.0201, 0.0277] | 1718 | 33 | 0.0235 | 0.0192 | [0.0137, 0.0269] | 0.0043 |
| 9 | [0.0277, 0.0449] | 1718 | 43 | 0.0347 | 0.0250 | [0.0186, 0.0335] | 0.0096 |
| 10 | [0.0449, 0.9961] | 1719 | 290 | 0.1843 | 0.1687 | [0.1517, 0.1871] | 0.0156 |

### High-Risk Subset Calibration (p >= Yellow Cutoff: 0.046864)

Segments with fewer than 30 events are suggestive, not established.

| Segment | Predicted Range | Count | Events | Mean Predicted | Actual Fraction | 95% Wilson CI | |Pred - Obs| |
|---|---|---|---|---|---|---|---|
| Segment 1 | [0.0469, 0.0544] | 323 | 13 | 0.0506 | 0.0402 | [0.0237, 0.0676] | 0.0103 |
| Segment 2 | [0.0544, 0.0671] | 322 | 12 | 0.0599 | 0.0373 | [0.0214, 0.0640] | 0.0227 |
| Segment 3 | [0.0671, 0.0941] | 322 | 15 | 0.0783 | 0.0466 | [0.0284, 0.0754] | 0.0318 |
| Segment 4 | [0.0941, 0.2376] | 322 | 46 | 0.1429 | 0.1429 | [0.1088, 0.1853] | 0.0000 |
| Segment 5 | [0.2376, 0.9961] | 323 | 201 | 0.6348 | 0.6223 | [0.5683, 0.6734] | 0.0125 |
| Total High-Risk | [0.046864, 0.9961] | 1612 | 287 | 0.1935 | 0.1780 | [0.1601, 0.1975] | 0.0155 |

## Limitations
- Fully synthetic data.
- The generator and the model share assumptions.
- Synthetic decline before an event is stronger than in real life, so predictions above 50% can occur.
- Red-flag symptoms are more predictive here than in real life.
- Events are spread evenly over days 8-60.
- No real-world validation.
- About 30% of events are generated as "sudden" (signal only on event_day, which is excluded), so with the 2-adjacent-day rule the achievable catch rate is roughly 70%.
- About 24% of the 2000 patients have an event within 60 days; this is high.
- EHR coefficient signs (diabetes, smoker, eGFR, family history) are not clinically interpretable: correlated features, ~300 independent event patients.
- Single-day alerts catch more events but at about 3x the alerts (not used).
- Yellow alerts are mostly false alarms (see precision table).
- Predicted percentages below about 9.4% are not precise (relative error <= 25% not established).

## How to read this
- **What the 7-day risk means**: For each day a patient wears their device, the system calculates the likelihood that an urgent hospital readmission will occur sometime within the next 7 days.
- **What Yellow and Red mean**: An alert triggers only when elevated risk is sustained across 2 consecutive days, or upon an acute red-flag symptom. A Yellow alert signals telemetry drifting from baseline recovery. A Red alert indicates marked deterioration or an acute red-flag symptom requiring urgent clinical review.
- **Difference between "on alert today" and "new alert"**: Being on alert today measures ongoing active status (the proportion of patients currently showing an active alert badge on the floor), whereas a new alert marks the first day an acute alert episode begins after previously being unflagged.
- **Patients on alert on an average day**: Across an average ward of 100 patients, approximately **1.15 patients are on Combined Red alert** on any given day (1.15 alert-days per 100 patient-days). Model-only Red accounts for **0.39 patients** and symptom-only Red accounts for **0.83 patients** per 100 on an average day. Approximately **2.69 patients are on Yellow alert** on any given day (2.69 alert-days per 100 patient-days).
- **Patients on ANY alert (Yellow or worse, including symptom Red) on an average day**: Across an average ward of 100 patients, approximately **3.28 patients are on ANY alert** on any given day (3.28 alert-days per 100 patient-days).
- **New alerts per day across 100 patients**: A service of 100 patients sees approximately **0.37 new Combined Red alert episodes per day** (about one new Red alert every **2.7 days**). Model-only Red produces **0.20 new episodes per day** (about one every **5.0 days**) and symptom-only Red produces **0.23 new episodes per day** (about one every **4.3 days**). Yellow alert produces **1.50 new alert episodes per day**.
- **Event-free patients flagged during stay**: Among patients who never experience an event, **17.5% are flagged at least once with Combined Red** across their stay (up to 60 days). Model-only Red flags **10.2%** and symptom-only Red flags **9.9%**. For Yellow alerts, **36.0% are flagged at least once**.
- **False alarms per true catch**: For Yellow alerts, there are approximately **3.35 false alarms per true catch** (72 true catches out of 313 episodes). For Red alerts (Combined), there are approximately **0.96 false alarms per true catch** (70 true catches out of 137 episodes; model-only Red has **0.59 false alarms per true catch**).
