"""
Stage 3 Training & Evaluation Pipeline for Causal Risk Forecaster

Features:
- Removes non-clinical / leaky features ("sd_t", "days_since_last_valid_reading")
- 15 causal physiological and EHR features with z-score clipping to [-4, 4]
- Std floor protection against zero/micro variance
- 2,000-patient synthetic cohort with patient-wise stratified split (60% Train, 20% Calib, 20% Test)
- Honest 2-consecutive-day alert evaluation with 7-day pre-event detection window
- Burden-matched cutoffs on CALIBRATION split (~3.0 alert-days/100d for Yellow, ~0.5 for Red)
- 1,000-resample patient-level bootstrap for 95% confidence intervals
- Serialization to twin/model.json, twin/zone_cutoffs.json, reports/metrics.json, reports/metrics.md
"""

import os
import sys
import json
import numpy as np

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT_DIR)

from data_gen.cohort_v2 import generate_synthetic_cohort
from twin.baseline import compute_personal_baseline
from twin.estimator_v2 import CausalKalmanFilter
from twin.features import FEATURE_NAMES, build_feature_rows
from sklearn.metrics import roc_auc_score, average_precision_score, brier_score_loss
from sklearn.ensemble import GradientBoostingClassifier

def fit_l2_logistic_regression(
    X: np.ndarray,
    y: np.ndarray,
    l2_reg: float = 5.0,
    max_iter: int = 35,
    tol: float = 1e-6
):
    """
    Fits L2-regularized logistic regression using Newton-Raphson in pure NumPy.
    Regularization is applied to feature weights, not to the intercept.
    """
    n_samples, n_features = X.shape
    X_aug = np.hstack([X, np.ones((n_samples, 1))])
    theta = np.zeros(n_features + 1)

    reg_diag = np.full(n_features + 1, l2_reg)
    reg_diag[-1] = 0.0
    Reg = np.diag(reg_diag)

    for it in range(max_iter):
        logits = np.clip(X_aug @ theta, -20.0, 20.0)
        p = 1.0 / (1.0 + np.exp(-logits))

        grad = X_aug.T @ (p - y) + Reg @ theta
        W = np.clip(p * (1.0 - p), 1e-6, 0.25)
        H = (X_aug.T * W) @ X_aug + Reg + np.eye(n_features + 1) * 1e-5

        delta = np.linalg.solve(H, grad)
        theta -= delta

        if np.linalg.norm(delta) < tol:
            break

    weights = theta[:-1]
    intercept = float(theta[-1])
    return weights, intercept

def fit_platt_scaling(
    logits: np.ndarray,
    y: np.ndarray,
    max_iter: int = 35,
    tol: float = 1e-6
):
    """
    Fits Platt scaling parameters (a, b) mapping raw logits to calibrated probabilities
    p = 1 / (1 + exp(-(a * logit + b))) using Newton-Raphson in pure NumPy.
    """
    S = np.column_stack([logits, np.ones_like(logits)])
    params = np.array([1.0, 0.0], dtype=float)

    for it in range(max_iter):
        calib_logits = np.clip(S @ params, -20.0, 20.0)
        p = 1.0 / (1.0 + np.exp(-calib_logits))

        grad = S.T @ (p - y)
        W = np.clip(p * (1.0 - p), 1e-6, 0.25)
        H = (S.T * W) @ S + np.eye(2) * 1e-4

        delta = np.linalg.solve(H, grad)
        params -= delta

        if np.linalg.norm(delta) < tol:
            break

    return float(params[0]), float(params[1])

def extract_patient_rows(patient_list, days_count: int = 60):
    """
    Extracts causal patient-day feature rows according to strict rules:
    - Only days t >= baseline lock day and where reading exists (resting_hr not None)
    - Drop rows where t >= event_day
    - For non-event patients, drop rows where t > days_count - 7
    - Label y = 1 if event_day in [t+1, t+7], else 0
    Features are generated via the shared twin.features.build_feature_rows.
    """
    kf = CausalKalmanFilter()
    X = []
    y = []
    hr_rule_scores = []
    patient_records = []
    row_count = 0

    for p in patient_list:
        readings = p["daily_readings"]
        base = compute_personal_baseline(readings)
        if not base or not base.get("is_calibrated"):
            continue

        kalman_states = kf.filter_trajectory(readings, base)
        ev_day = p["event_day"]

        p_entry = {
            "id": p["id"],
            "is_event": ev_day is not None,
            "event_day": ev_day,
            "days": [],
            "row_indices": [],
            "hr_diffs": []
        }

        feature_rows = build_feature_rows(p, base, kalman_states)
        readings_by_day = {r["day"]: r for r in readings}

        for row in feature_rows:
            t = row["day"]
            if ev_day is not None and t >= ev_day:
                continue
            if ev_day is None and t > (days_count - 7):
                continue

            label = 1 if (ev_day is not None and (t + 1 <= ev_day <= t + 7)) else 0
            r = readings_by_day[t]
            hr_diff = float(r["resting_hr"] - base["hr_0"])

            X.append(row["x"])
            y.append(label)
            hr_rule_scores.append(hr_diff)

            p_entry["days"].append(t)
            p_entry["row_indices"].append(row_count)
            p_entry["hr_diffs"].append(hr_diff)
            row_count += 1

        patient_records.append(p_entry)

    return (
        np.array(X, dtype=float),
        np.array(y, dtype=int),
        np.array(hr_rule_scores, dtype=float),
        patient_records
    )

def build_pairwise_min_eval_scores(patient_records, scores_array):
    """
    Constructs the sequence of 2-consecutive day minimum scores for all evaluated days
    (excluding the last 7 days of event patients).
    If a day does not have an immediate valid preceding day (t - (t-1) == 1),
    its effective consecutive score is set to -1e9.
    """
    U = []
    for p in patient_records:
        is_event = p["is_event"]
        ev_day = p["event_day"]
        days = p["days"]
        row_indices = p["row_indices"]
        for k in range(len(days)):
            day = days[k]
            if is_event and day > (ev_day - 8):
                continue
            if k > 0 and days[k-1] == day - 1:
                U.append(min(scores_array[row_indices[k-1]], scores_array[row_indices[k]]))
            else:
                U.append(-1e9)
    return np.array(U, dtype=float)

def evaluate_model_alerts(patient_records, scores_array, y_cut: float, r_cut: float):
    """
    Honest alert evaluation per FIX 3:
    - Alert requires score >= cutoff on 2 consecutive daily readings (days t-1 and t, both present).
    - Event caught only if alert occurs in [event_day - 7, event_day - 1].
    - Lead time = event_day - first alert day in that window.
    - Alert-days per 100 pt-days (for event patients, exclude their last 7 days).
    - % of event-free patients with at least one alert.
    - Alert episodes per patient-month (30 patient-days).
    """
    results = {}
    for zone_name, cutoff in [("Yellow", y_cut), ("Red", r_cut)]:
        total_events = sum(1 for p in patient_records if p["is_event"])
        total_nonevents = sum(1 for p in patient_records if not p["is_event"])

        caught_events = 0
        lead_times = []
        nonevent_with_alert = 0

        eval_days_count = 0
        alert_days_count = 0
        episodes_count = 0

        for p in patient_records:
            is_event = p["is_event"]
            ev_day = p["event_day"]
            days = p["days"]
            row_indices = p["row_indices"]

            p_alerts = []
            for k in range(len(days)):
                day = days[k]
                is_alert = False
                if k > 0 and days[k-1] == day - 1:
                    if scores_array[row_indices[k-1]] >= cutoff and scores_array[row_indices[k]] >= cutoff:
                        is_alert = True
                p_alerts.append((day, is_alert))

            if is_event:
                catch_days = [day for day, is_a in p_alerts if is_a and (ev_day - 7 <= day <= ev_day - 1)]
                if len(catch_days) > 0:
                    caught_events += 1
                    lead_times.append(ev_day - min(catch_days))
            else:
                if any(is_a for _, is_a in p_alerts):
                    nonevent_with_alert += 1

            in_episode = False
            for day, is_a in p_alerts:
                if is_event and day > (ev_day - 8):
                    continue
                eval_days_count += 1
                if is_a:
                    alert_days_count += 1
                    if not in_episode:
                        episodes_count += 1
                        in_episode = True
                else:
                    in_episode = False

        catch_rate = (caught_events / max(total_events, 1)) * 100.0
        med_lead = float(np.median(lead_times)) if lead_times else 0.0
        alert_rate = (alert_days_count / max(eval_days_count, 1)) * 100.0
        pct_nonevent_alert = (nonevent_with_alert / max(total_nonevents, 1)) * 100.0
        episodes_per_month = episodes_count / (max(eval_days_count, 1) / 30.0)

        results[zone_name] = {
            "catch_rate": round(catch_rate, 2),
            "lead_time": round(med_lead, 1),
            "alert_rate_100d": round(alert_rate, 2),
            "pct_nonevent_alert": round(pct_nonevent_alert, 2),
            "episodes_per_month": round(episodes_per_month, 2)
        }
    return results

def evaluate_red_variants(patient_records, test_pts, scores_lr, r_cut_lr):
    """
    Evaluates the three Red triage variants on TEST split per STEP 4:
    1. model_only (current 2-consecutive-day rule)
    2. symptom_only (any acute red_flag recorded in [day-3, day])
    3. combined (either model_only or symptom_only)
    """
    test_pt_map = {p["id"]: p for p in test_pts}
    total_events = sum(1 for p in patient_records if p["is_event"])
    total_nonevents = sum(1 for p in patient_records if not p["is_event"])

    variants_res = {}
    for mode in ["model_only", "symptom_only", "combined"]:
        caught_events = 0
        lead_times = []
        nonevent_with_alert = 0
        eval_days_count = 0
        alert_days_count = 0
        episodes_count = 0

        for p in patient_records:
            is_event = p["is_event"]
            ev_day = p["event_day"]
            days = p["days"]
            row_indices = p["row_indices"]
            raw_pt = test_pt_map[p["id"]]
            rf_days = {r["day"] for r in raw_pt.get("daily_readings", []) if r.get("red_flag") is not None}

            p_alerts = []
            for k in range(len(days)):
                day = days[k]
                is_model = False
                if k > 0 and days[k-1] == day - 1:
                    if scores_lr[row_indices[k-1]] >= r_cut_lr and scores_lr[row_indices[k]] >= r_cut_lr:
                        is_model = True
                is_symp = any((day - 3) <= d <= day for d in rf_days)

                if mode == "model_only":
                    is_alert = is_model
                elif mode == "symptom_only":
                    is_alert = is_symp
                else:
                    is_alert = is_model or is_symp
                p_alerts.append((day, is_alert))

            if is_event:
                catch_days = [day for day, is_a in p_alerts if is_a and (ev_day - 7 <= day <= ev_day - 1)]
                if len(catch_days) > 0:
                    caught_events += 1
                    lead_times.append(ev_day - min(catch_days))
            else:
                if any(is_a for _, is_a in p_alerts):
                    nonevent_with_alert += 1

            in_episode = False
            for day, is_a in p_alerts:
                if is_event and day > (ev_day - 8):
                    continue
                eval_days_count += 1
                if is_a:
                    alert_days_count += 1
                    if not in_episode:
                        episodes_count += 1
                        in_episode = True
                else:
                    in_episode = False

        variants_res[mode] = {
            "catch_rate": round((caught_events / max(total_events, 1)) * 100.0, 2),
            "lead_time": round(float(np.median(lead_times)), 1) if lead_times else 0.0,
            "alert_rate_100d": round((alert_days_count / max(eval_days_count, 1)) * 100.0, 2),
            "pct_nonevent_alert": round((nonevent_with_alert / max(total_nonevents, 1)) * 100.0, 2),
            "episodes_per_month": round(episodes_count / (max(eval_days_count, 1) / 30.0), 2)
        }
    return variants_res

def compute_episode_precision(patient_records, test_pts, scores_lr, y_cut_lr, r_cut_lr):
    """
    Computes episode-level precision metrics on TEST split per PART A4:
    An episode is a run of consecutive alert days for a single patient (split on missing calendar days).
    An episode is true if at least one of its days falls within [event_day - 7, event_day - 1].
    """
    test_pt_map = {p["id"]: p for p in test_pts}
    ep_results = {}
    for mode in ["yellow", "model_red", "symptom_red", "combined_red"]:
        episodes = []
        for p in patient_records:
            ev_day = p["event_day"]
            is_event = p["is_event"]
            days = p["days"]
            row_indices = p["row_indices"]
            raw_pt = test_pt_map[p["id"]]
            rf_days = {r["day"] for r in raw_pt.get("daily_readings", []) if r.get("red_flag") is not None}

            curr_ep = []
            prev_d = None
            for k in range(len(days)):
                d = days[k]
                is_y = (k > 0 and days[k-1] == d - 1 and scores_lr[row_indices[k-1]] >= y_cut_lr and scores_lr[row_indices[k]] >= y_cut_lr)
                is_r = (k > 0 and days[k-1] == d - 1 and scores_lr[row_indices[k-1]] >= r_cut_lr and scores_lr[row_indices[k]] >= r_cut_lr)
                is_s = any((d - 3) <= f <= d for f in rf_days)
                if mode == "yellow":
                    al = is_y
                elif mode == "model_red":
                    al = is_r
                elif mode == "symptom_red":
                    al = is_s
                elif mode == "combined_red":
                    al = is_r or is_s

                if al:
                    if curr_ep and prev_d is not None and d != prev_d + 1:
                        is_true = is_event and any(ev_day - 7 <= ed <= ev_day - 1 for ed in curr_ep)
                        episodes.append({"days": curr_ep, "true": is_true})
                        curr_ep = [d]
                    else:
                        curr_ep.append(d)
                    prev_d = d
                else:
                    if curr_ep:
                        is_true = is_event and any(ev_day - 7 <= ed <= ev_day - 1 for ed in curr_ep)
                        episodes.append({"days": curr_ep, "true": is_true})
                        curr_ep = []
                    prev_d = d
            if curr_ep:
                is_true = is_event and any(ev_day - 7 <= ed <= ev_day - 1 for ed in curr_ep)
                episodes.append({"days": curr_ep, "true": is_true})

        n_tot = len(episodes)
        n_true = sum(1 for e in episodes if e["true"])
        n_false = n_tot - n_true
        prec = round((n_true / n_tot * 100.0) if n_tot else 0.0, 2)
        fa_per_true = round(n_false / n_true, 2) if n_true else 0.0
        ep_results[mode] = {
            "episodes": n_tot,
            "true_episodes": n_true,
            "precision": prec,
            "false_alarms_per_true": fa_per_true
        }
    return ep_results

def bootstrap_all_models_and_differences(
    patient_records,
    test_pts,
    y_test: np.ndarray,
    p_test_lr: np.ndarray,
    p_test_gb: np.ndarray,
    p_test_hr: np.ndarray,
    cutoffs: dict,
    n_resamples: int = 1000,
    seed: int = 123
):
    """
    Patient-level paired bootstrap (1,000 resamples) on TEST patients per STEP 3.
    Computes all three models on the same sampled patients.
    Returns:
    1. 95% CIs for all three models across all benchmark rows.
    2. Paired differences (LR minus HR, LR minus GB) with mean and 95% CI.
    """
    rng = np.random.default_rng(seed)
    n_pts = len(patient_records)
    test_pt_map = {p["id"]: p for p in test_pts}

    pt_data = []
    for p in patient_records:
        is_event = p["is_event"]
        ev_day = p["event_day"]
        days = p["days"]
        row_indices = p["row_indices"]
        labels = y_test[row_indices]
        scores_lr = p_test_lr[row_indices]
        scores_gb = p_test_gb[row_indices]
        scores_hr = p_test_hr[row_indices]

        entry = {
            "is_event": is_event,
            "ev_day": ev_day,
            "labels": labels,
            "scores_lr": scores_lr,
            "scores_gb": scores_gb,
            "scores_hr": scores_hr,
            "eval_days": 0,
            "models": {}
        }

        for m_key, scores_m, y_c, r_c in [
            ("lr", scores_lr, cutoffs["lr"]["yellow"], cutoffs["lr"]["red"]),
            ("gb", scores_gb, cutoffs["gb"]["yellow"], cutoffs["gb"]["red"]),
            ("hr", scores_hr, cutoffs["hr"]["yellow"], cutoffs["hr"]["red"])
        ]:
            p_alerts_y = []
            p_alerts_r = []
            for k in range(len(days)):
                day = days[k]
                is_ay = False
                is_ar = False
                if k > 0 and days[k-1] == day - 1:
                    if scores_m[k-1] >= y_c and scores_m[k] >= y_c:
                        is_ay = True
                    if scores_m[k-1] >= r_c and scores_m[k] >= r_c:
                        is_ar = True
                p_alerts_y.append((day, is_ay))
                p_alerts_r.append((day, is_ar))

            caught_y = False
            lead_y = None
            caught_r = False
            lead_r = None
            if is_event:
                c_days_y = [d for d, is_a in p_alerts_y if is_a and (ev_day - 7 <= d <= ev_day - 1)]
                if c_days_y:
                    caught_y = True
                    lead_y = ev_day - min(c_days_y)
                c_days_r = [d for d, is_a in p_alerts_r if is_a and (ev_day - 7 <= d <= ev_day - 1)]
                if c_days_r:
                    caught_r = True
                    lead_r = ev_day - min(c_days_r)

            eval_d = 0
            ad_y = 0
            ad_r = 0
            ep_y = 0
            ep_r = 0
            in_ep_y = False
            in_ep_r = False

            for (day, is_ay), (_, is_ar) in zip(p_alerts_y, p_alerts_r):
                if is_event and day > (ev_day - 8):
                    continue
                eval_d += 1
                if is_ay:
                    ad_y += 1
                    if not in_ep_y:
                        ep_y += 1
                        in_ep_y = True
                else:
                    in_ep_y = False

                if is_ar:
                    ad_r += 1
                    if not in_ep_r:
                        ep_r += 1
                        in_ep_r = True
                else:
                    in_ep_r = False

            has_ne_y = not is_event and any(is_a for _, is_a in p_alerts_y)
            has_ne_r = not is_event and any(is_a for _, is_a in p_alerts_r)

            entry["models"][m_key] = {
                "caught_y": caught_y,
                "lead_y": lead_y,
                "caught_r": caught_r,
                "lead_r": lead_r,
                "alert_days_y": ad_y,
                "alert_days_r": ad_r,
                "episodes_y": ep_y,
                "episodes_r": ep_r,
                "has_ne_y": has_ne_y,
                "has_ne_r": has_ne_r
            }
            entry["eval_days"] = eval_d

        pt_data.append(entry)

    boot_dist = {
        "lr": {"auc": [], "pr": [], "brier": [], "skill": [], "c_y": [], "c_r": [], "ad_y": [], "ad_r": [], "lead_y": [], "lead_r": [], "ne_y": [], "ne_r": [], "ep_y": [], "ep_r": []},
        "hr": {"auc": [], "pr": [], "c_y": [], "c_r": [], "ad_y": [], "ad_r": [], "lead_y": [], "lead_r": [], "ne_y": [], "ne_r": [], "ep_y": [], "ep_r": []},
        "gb": {"auc": [], "pr": [], "brier": [], "skill": [], "c_y": [], "c_r": [], "ad_y": [], "ad_r": [], "lead_y": [], "lead_r": [], "ne_y": [], "ne_r": [], "ep_y": [], "ep_r": []}
    }

    paired_diffs_dist = {
        "lr_minus_hr": {"roc_auc": [], "pr_auc": [], "yellow_catch": [], "red_catch": [], "yellow_alert_rate": [], "red_alert_rate": []},
        "lr_minus_gb": {"roc_auc": [], "pr_auc": [], "yellow_catch": [], "red_catch": [], "yellow_alert_rate": [], "red_alert_rate": []}
    }

    for b in range(n_resamples):
        sample_idx = rng.choice(n_pts, size=n_pts, replace=True)

        tot_ev = 0
        tot_nonev = 0
        tot_eval_d = 0

        m_counts = {
            m: {"c_y": 0, "c_r": 0, "ad_y": 0, "ad_r": 0, "ne_y": 0, "ne_r": 0, "ep_y": 0, "ep_r": 0, "leads_y": [], "leads_r": []}
            for m in ["lr", "hr", "gb"]
        }

        b_y_list = []
        b_s_lr_list = []
        b_s_gb_list = []
        b_s_hr_list = []

        for idx in sample_idx:
            item = pt_data[idx]
            if item["is_event"]:
                tot_ev += 1
            else:
                tot_nonev += 1
            tot_eval_d += item["eval_days"]

            b_y_list.append(item["labels"])
            b_s_lr_list.append(item["scores_lr"])
            b_s_gb_list.append(item["scores_gb"])
            b_s_hr_list.append(item["scores_hr"])

            for m in ["lr", "hr", "gb"]:
                mi = item["models"][m]
                if item["is_event"]:
                    if mi["caught_y"]:
                        m_counts[m]["c_y"] += 1
                        m_counts[m]["leads_y"].append(mi["lead_y"])
                    if mi["caught_r"]:
                        m_counts[m]["c_r"] += 1
                        m_counts[m]["leads_r"].append(mi["lead_r"])
                else:
                    if mi["has_ne_y"]:
                        m_counts[m]["ne_y"] += 1
                    if mi["has_ne_r"]:
                        m_counts[m]["ne_r"] += 1

                m_counts[m]["ad_y"] += mi["alert_days_y"]
                m_counts[m]["ad_r"] += mi["alert_days_r"]
                m_counts[m]["ep_y"] += mi["episodes_y"]
                m_counts[m]["ep_r"] += mi["episodes_r"]

        b_y = np.concatenate(b_y_list)
        b_s_lr = np.concatenate(b_s_lr_list)
        b_s_gb = np.concatenate(b_s_gb_list)
        b_s_hr = np.concatenate(b_s_hr_list)

        if len(np.unique(b_y)) > 1:
            auc_lr = float(roc_auc_score(b_y, b_s_lr))
            auc_gb = float(roc_auc_score(b_y, b_s_gb))
            auc_hr = float(roc_auc_score(b_y, b_s_hr))

            ap_lr = float(average_precision_score(b_y, b_s_lr))
            ap_gb = float(average_precision_score(b_y, b_s_gb))
            ap_hr = float(average_precision_score(b_y, b_s_hr))
        else:
            auc_lr, auc_gb, auc_hr = 0.5, 0.5, 0.5
            ap_lr, ap_gb, ap_hr = 0.0, 0.0, 0.0

        brier_lr = float(brier_score_loss(b_y, b_s_lr))
        brier_gb = float(brier_score_loss(b_y, b_s_gb))
        p_rate = float(np.mean(b_y))
        denom = p_rate * (1.0 - p_rate)
        skill_lr = float(1.0 - (brier_lr / denom)) if denom > 0 else 0.0
        skill_gb = float(1.0 - (brier_gb / denom)) if denom > 0 else 0.0

        boot_dist["lr"]["auc"].append(auc_lr)
        boot_dist["lr"]["pr"].append(ap_lr)
        boot_dist["lr"]["brier"].append(brier_lr)
        boot_dist["lr"]["skill"].append(skill_lr)

        boot_dist["gb"]["auc"].append(auc_gb)
        boot_dist["gb"]["pr"].append(ap_gb)
        boot_dist["gb"]["brier"].append(brier_gb)
        boot_dist["gb"]["skill"].append(skill_gb)

        boot_dist["hr"]["auc"].append(auc_hr)
        boot_dist["hr"]["pr"].append(ap_hr)

        res_b = {}
        for m in ["lr", "hr", "gb"]:
            cy = (m_counts[m]["c_y"] / max(tot_ev, 1)) * 100.0
            cr = (m_counts[m]["c_r"] / max(tot_ev, 1)) * 100.0
            ay = (m_counts[m]["ad_y"] / max(tot_eval_d, 1)) * 100.0
            ar = (m_counts[m]["ad_r"] / max(tot_eval_d, 1)) * 100.0
            ney = (m_counts[m]["ne_y"] / max(tot_nonev, 1)) * 100.0
            ner = (m_counts[m]["ne_r"] / max(tot_nonev, 1)) * 100.0
            epy = m_counts[m]["ep_y"] / (max(tot_eval_d, 1) / 30.0)
            epr = m_counts[m]["ep_r"] / (max(tot_eval_d, 1) / 30.0)
            ly = float(np.median(m_counts[m]["leads_y"])) if m_counts[m]["leads_y"] else 0.0
            lr_d = float(np.median(m_counts[m]["leads_r"])) if m_counts[m]["leads_r"] else 0.0

            boot_dist[m]["c_y"].append(cy)
            boot_dist[m]["c_r"].append(cr)
            boot_dist[m]["ad_y"].append(ay)
            boot_dist[m]["ad_r"].append(ar)
            boot_dist[m]["ne_y"].append(ney)
            boot_dist[m]["ne_r"].append(ner)
            boot_dist[m]["ep_y"].append(epy)
            boot_dist[m]["ep_r"].append(epr)
            boot_dist[m]["lead_y"].append(ly)
            boot_dist[m]["lead_r"].append(lr_d)

            res_b[m] = {"c_y": cy, "c_r": cr, "ad_y": ay, "ad_r": ar}

        paired_diffs_dist["lr_minus_hr"]["roc_auc"].append(auc_lr - auc_hr)
        paired_diffs_dist["lr_minus_hr"]["pr_auc"].append(ap_lr - ap_hr)
        paired_diffs_dist["lr_minus_hr"]["yellow_catch"].append(res_b["lr"]["c_y"] - res_b["hr"]["c_y"])
        paired_diffs_dist["lr_minus_hr"]["red_catch"].append(res_b["lr"]["c_r"] - res_b["hr"]["c_r"])
        paired_diffs_dist["lr_minus_hr"]["yellow_alert_rate"].append(res_b["lr"]["ad_y"] - res_b["hr"]["ad_y"])
        paired_diffs_dist["lr_minus_hr"]["red_alert_rate"].append(res_b["lr"]["ad_r"] - res_b["hr"]["ad_r"])

        paired_diffs_dist["lr_minus_gb"]["roc_auc"].append(auc_lr - auc_gb)
        paired_diffs_dist["lr_minus_gb"]["pr_auc"].append(ap_lr - ap_gb)
        paired_diffs_dist["lr_minus_gb"]["yellow_catch"].append(res_b["lr"]["c_y"] - res_b["gb"]["c_y"])
        paired_diffs_dist["lr_minus_gb"]["red_catch"].append(res_b["lr"]["c_r"] - res_b["gb"]["c_r"])
        paired_diffs_dist["lr_minus_gb"]["yellow_alert_rate"].append(res_b["lr"]["ad_y"] - res_b["gb"]["ad_y"])
        paired_diffs_dist["lr_minus_gb"]["red_alert_rate"].append(res_b["lr"]["ad_r"] - res_b["gb"]["ad_r"])

    def ci(arr, precision=4):
        return (round(float(np.percentile(arr, 2.5)), precision), round(float(np.percentile(arr, 97.5)), precision))

    ci_results = {}
    for m in ["lr", "hr", "gb"]:
        m_ci = {
            "roc_auc": ci(boot_dist[m]["auc"], 4),
            "pr_auc": ci(boot_dist[m]["pr"], 4),
            "yellow_catch": ci(boot_dist[m]["c_y"], 1),
            "yellow_lead_time": ci(boot_dist[m]["lead_y"], 1),
            "yellow_alert_rate": ci(boot_dist[m]["ad_y"], 2),
            "yellow_pct_nonevent": ci(boot_dist[m]["ne_y"], 1),
            "yellow_episodes": ci(boot_dist[m]["ep_y"], 2),
            "red_catch": ci(boot_dist[m]["c_r"], 1),
            "red_lead_time": ci(boot_dist[m]["lead_r"], 1),
            "red_alert_rate": ci(boot_dist[m]["ad_r"], 2),
            "red_pct_nonevent": ci(boot_dist[m]["ne_r"], 1),
            "red_episodes": ci(boot_dist[m]["ep_r"], 2)
        }
        if "brier" in boot_dist[m]:
            m_ci["brier_score"] = ci(boot_dist[m]["brier"], 4)
            m_ci["brier_skill"] = ci(boot_dist[m]["skill"], 4)
        ci_results[m] = m_ci

    paired_summary = {}
    for pair_key in ["lr_minus_hr", "lr_minus_gb"]:
        paired_summary[pair_key] = {}
        for m_name in ["roc_auc", "pr_auc", "yellow_catch", "red_catch", "yellow_alert_rate", "red_alert_rate"]:
            vals = paired_diffs_dist[pair_key][m_name]
            prec = 4 if "auc" in m_name else (1 if "catch" in m_name else 2)
            paired_summary[pair_key][m_name] = {
                "mean": round(float(np.mean(vals)), prec),
                "ci": (round(float(np.percentile(vals, 2.5)), prec), round(float(np.percentile(vals, 97.5)), prec))
            }

    return ci_results, paired_summary

def main():
    print("==================================================================")
    print("STAGE 3: CAUSAL DIGITAL TWIN RISK FORECASTER TRAINING & BENCHMARK")
    print("==================================================================")

    # 1. Cohort Generation (seed 42, 2000 patients, 60 days)
    print("\nGenerating synthetic cohort (seed=42, 2000 patients, 60 days)...")
    cohort = generate_synthetic_cohort(num_patients=2000, days_count=60, seed=42)

    events = [p for p in cohort if p["event_day"] is not None]
    nonevents = [p for p in cohort if p["event_day"] is None]

    rng_split = np.random.default_rng(42)
    rng_split.shuffle(events)
    rng_split.shuffle(nonevents)

    n_ev_train = int(0.60 * len(events))
    n_ev_calib = int(0.20 * len(events))
    train_events = events[:n_ev_train]
    calib_events = events[n_ev_train:n_ev_train + n_ev_calib]
    test_events = events[n_ev_train + n_ev_calib:]

    n_no_train = int(0.60 * len(nonevents))
    n_no_calib = int(0.20 * len(nonevents))
    train_nonevents = nonevents[:n_no_train]
    calib_nonevents = nonevents[n_no_train:n_no_train + n_no_calib]
    test_nonevents = nonevents[n_no_train + n_no_calib:]

    train_pts = train_events + train_nonevents
    calib_pts = calib_events + calib_nonevents
    test_pts = test_events + test_nonevents

    print(f"  -> Total cohort: {len(cohort)} patients ({len(events)} events, {len(nonevents)} non-events)")
    print(f"  -> Train split: {len(train_pts)} patients ({len(train_events)} events)")
    print(f"  -> Calibration split: {len(calib_pts)} patients ({len(calib_events)} events)")
    print(f"  -> Test split: {len(test_pts)} patients ({len(test_events)} events)")

    # 2. Extract feature rows (15 features) via shared twin.features module
    print("\nExtracting causal feature rows via twin.features.build_feature_rows...")
    X_train, y_train, hr_train, pt_rec_train = extract_patient_rows(train_pts)
    X_calib, y_calib, hr_calib, pt_rec_calib = extract_patient_rows(calib_pts)
    X_test, y_test, hr_test, pt_rec_test = extract_patient_rows(test_pts)

    print(f"  -> Train rows: {len(y_train)} ({np.sum(y_train)} positive, {np.mean(y_train)*100:.2f}%)")
    print(f"  -> Calib rows: {len(y_calib)} ({np.sum(y_calib)} positive, {np.mean(y_calib)*100:.2f}%)")
    print(f"  -> Test rows:  {len(y_test)} ({np.sum(y_test)} positive, {np.mean(y_test)*100:.2f}%)")

    # Standardization with std floor and [-4, 4] clipping
    mean_vec = np.mean(X_train, axis=0)
    std_vec = np.std(X_train, axis=0)
    for j, name in enumerate(FEATURE_NAMES):
        thresh = 1e-3 * max(1.0, abs(mean_vec[j]))
        if std_vec[j] < thresh:
            std_vec[j] = 1.0

    X_train_std = np.clip((X_train - mean_vec) / std_vec, -4.0, 4.0)
    X_calib_std = np.clip((X_calib - mean_vec) / std_vec, -4.0, 4.0)
    X_test_std = np.clip((X_test - mean_vec) / std_vec, -4.0, 4.0)

    # Fit L2 Logistic Regression on TRAIN
    print("\nFitting L2 Logistic Regression on TRAIN split...")
    weights, intercept = fit_l2_logistic_regression(X_train_std, y_train, l2_reg=5.0)

    # Fit Platt scaling on CALIBRATION ONLY
    print("Fitting Platt scaling on CALIBRATION split...")
    calib_raw_logits = X_calib_std @ weights + intercept
    platt_a, platt_b = fit_platt_scaling(calib_raw_logits, y_calib)
    print(f"  -> Platt scaling parameters: a = {platt_a:.4f}, b = {platt_b:.4f}")

    p_calib_lr = 1.0 / (1.0 + np.exp(-(platt_a * calib_raw_logits + platt_b)))

    # Fit GradientBoosting benchmark on TRAIN
    print("Fitting GradientBoostingClassifier comparison benchmark on TRAIN...")
    gb = GradientBoostingClassifier(n_estimators=100, max_depth=3, learning_rate=0.1, random_state=42)
    gb.fit(X_train_std, y_train)
    p_calib_gb = gb.predict_proba(X_calib_std)[:, 1]

    # STEP 2: Zone Cutoffs rounded to 6 decimals ONCE and saved to twin/zone_cutoffs.json
    print("\n[STEP 2] Determining matched-burden cutoffs on CALIBRATION split and rounding to 6 decimals...")
    u_calib_lr = build_pairwise_min_eval_scores(pt_rec_calib, p_calib_lr)
    u_calib_gb = build_pairwise_min_eval_scores(pt_rec_calib, p_calib_gb)
    u_calib_hr = build_pairwise_min_eval_scores(pt_rec_calib, hr_calib)

    y_cut_lr_raw = float(np.percentile(u_calib_lr, 97.0))
    r_cut_lr_raw = float(np.percentile(u_calib_lr, 99.5))

    y_cut_lr = round(y_cut_lr_raw, 6)
    r_cut_lr = round(r_cut_lr_raw, 6)

    y_cut_gb = round(float(np.percentile(u_calib_gb, 97.0)), 6)
    r_cut_gb = round(float(np.percentile(u_calib_gb, 99.5)), 6)

    y_cut_hr = round(float(np.percentile(u_calib_hr, 97.0)), 2)
    r_cut_hr = round(float(np.percentile(u_calib_hr, 99.5)), 2)

    # Save to twin/zone_cutoffs.json
    cutoffs_data = {
        "yellow_cutoff": y_cut_lr,
        "red_cutoff": r_cut_lr,
        "hysteresis_nights": 2,
        "dedup_hours": 72
    }
    cutoffs_path = os.path.join(ROOT_DIR, "twin", "zone_cutoffs.json")
    with open(cutoffs_path, "w") as f:
        json.dump(cutoffs_data, f, indent=2)
    print(f"  -> Saved matched zone cutoffs to {cutoffs_path}:")
    print(f"     Yellow = {y_cut_lr:.6f} (raw: {y_cut_lr_raw:.8f})")
    print(f"     Red    = {r_cut_lr:.6f} (raw: {r_cut_lr_raw:.8f})")

    # Load back saved values to ensure test evaluation uses the exact shipped cutoffs
    with open(cutoffs_path, "r") as f:
        loaded_cutoffs = json.load(f)
    y_cut_lr = float(loaded_cutoffs["yellow_cutoff"])
    r_cut_lr = float(loaded_cutoffs["red_cutoff"])

    # Predictions on unseen TEST split
    print("\nEvaluating models on unseen TEST split...")
    test_raw_logits = X_test_std @ weights + intercept
    test_calib_logits = platt_a * test_raw_logits + platt_b
    p_test_lr = 1.0 / (1.0 + np.exp(-test_calib_logits))
    p_test_gb = gb.predict_proba(X_test_std)[:, 1]
    p_test_hr = hr_test

    p_test_rate = float(np.mean(y_test))

    auc_lr = float(roc_auc_score(y_test, p_test_lr))
    auc_gb = float(roc_auc_score(y_test, p_test_gb))
    auc_hr = float(roc_auc_score(y_test, p_test_hr))

    ap_lr = float(average_precision_score(y_test, p_test_lr))
    ap_gb = float(average_precision_score(y_test, p_test_gb))
    ap_hr = float(average_precision_score(y_test, p_test_hr))

    brier_lr = float(brier_score_loss(y_test, p_test_lr))
    brier_gb = float(brier_score_loss(y_test, p_test_gb))
    denom = p_test_rate * (1.0 - p_test_rate)
    skill_lr = float(1.0 - (brier_lr / denom))
    skill_gb = float(1.0 - (brier_gb / denom))

    alerts_lr = evaluate_model_alerts(pt_rec_test, p_test_lr, y_cut_lr, r_cut_lr)
    alerts_gb = evaluate_model_alerts(pt_rec_test, p_test_gb, y_cut_gb, r_cut_gb)
    alerts_hr = evaluate_model_alerts(pt_rec_test, p_test_hr, y_cut_hr, r_cut_hr)

    # STEP 4: Acute Symptom-Triggered Red Alerts Evaluation
    print("\n[STEP 4] Evaluating acute symptom-triggered Red alerts (3 variants)...")
    red_variants = evaluate_red_variants(pt_rec_test, test_pts, p_test_lr, r_cut_lr)
    print(f"  -> (1) Model-only Red: {red_variants['model_only']['alert_rate_100d']:.2f} alert-days/100d | {red_variants['model_only']['catch_rate']:.1f}% catch | {red_variants['model_only']['pct_nonevent_alert']:.1f}% event-free | {red_variants['model_only']['episodes_per_month']:.2f} ep/mo")
    print(f"  -> (2) Symptom-only Red: {red_variants['symptom_only']['alert_rate_100d']:.2f} alert-days/100d | {red_variants['symptom_only']['catch_rate']:.1f}% catch | {red_variants['symptom_only']['pct_nonevent_alert']:.1f}% event-free | {red_variants['symptom_only']['episodes_per_month']:.2f} ep/mo")
    print(f"  -> (3) Combined Red:   {red_variants['combined']['alert_rate_100d']:.2f} alert-days/100d | {red_variants['combined']['catch_rate']:.1f}% catch | {red_variants['combined']['pct_nonevent_alert']:.1f}% event-free | {red_variants['combined']['episodes_per_month']:.2f} ep/mo")

    # Calibration analysis (Logistic model on TEST)
    mean_pred_lr = float(np.mean(p_test_lr))
    obs_rate_lr = float(np.mean(y_test))

    quantiles = np.linspace(0, 100, 11)
    q_edges = np.percentile(p_test_lr, quantiles)
    calib_table = []
    ece_weighted_sum = 0.0
    def compute_wilson_ci(events: int, n: int, z: float = 1.959963984540054):
        if n == 0:
            return (0.0, 0.0)
        p_hat = events / n
        denom = 1.0 + (z**2) / n
        center = (p_hat + (z**2) / (2.0 * n)) / denom
        half_width = (z * np.sqrt((p_hat * (1.0 - p_hat) + (z**2) / (4.0 * n)) / n)) / denom
        lower = max(0.0, center - half_width)
        upper = min(1.0, center + half_width)
        return (round(float(lower), 4), round(float(upper), 4))

    for b in range(10):
        low, high = q_edges[b], q_edges[b+1]
        mask = (p_test_lr >= low) & (p_test_lr <= high) if b == 9 else (p_test_lr >= low) & (p_test_lr < high)
        n_b = int(np.sum(mask))
        ev_b = int(np.sum(y_test[mask]))
        p_mean = float(np.mean(p_test_lr[mask])) if n_b > 0 else 0.0
        y_mean = float(np.mean(y_test[mask])) if n_b > 0 else 0.0
        diff_b = abs(p_mean - y_mean)
        ece_weighted_sum += (n_b / len(y_test)) * diff_b
        calib_table.append({
            "bin": b + 1,
            "pred_range": f"[{low:.4f}, {high:.4f}]",
            "count": n_b,
            "mean_pred": round(p_mean, 4),
            "actual_fraction": round(y_mean, 4),
            "abs_error": round(diff_b, 4),
            "events": ev_b,
            "wilson_ci": list(compute_wilson_ci(ev_b, n_b))
        })
    ece_lr = round(float(ece_weighted_sum), 4)

    # Second calibration table: rows with p >= yellow cutoff
    high_risk_mask = p_test_lr >= y_cut_lr
    high_p = p_test_lr[high_risk_mask]
    high_y = y_test[high_risk_mask]
    high_count = int(np.sum(high_risk_mask))
    high_events = int(np.sum(high_y))
    high_mean_pred = float(np.mean(high_p)) if high_count > 0 else 0.0
    high_obs_rate = float(np.mean(high_y)) if high_count > 0 else 0.0
    high_ci = list(compute_wilson_ci(high_events, high_count))

    high_calib_table = []
    if high_count >= 5:
        h_quantiles = np.linspace(0, 100, 6)
        h_edges = np.percentile(high_p, h_quantiles)
        for hb in range(5):
            h_low, h_high = h_edges[hb], h_edges[hb+1]
            h_mask = (high_p >= h_low) & (high_p <= h_high) if hb == 4 else (high_p >= h_low) & (high_p < h_high)
            n_hb = int(np.sum(h_mask))
            ev_hb = int(np.sum(high_y[h_mask]))
            p_hb = float(np.mean(high_p[h_mask])) if n_hb > 0 else 0.0
            y_hb = float(np.mean(high_y[h_mask])) if n_hb > 0 else 0.0
            high_calib_table.append({
                "segment": hb + 1,
                "pred_range": f"[{h_low:.4f}, {h_high:.4f}]",
                "count": n_hb,
                "mean_pred": round(p_hb, 4),
                "actual_fraction": round(y_hb, 4),
                "abs_error": round(abs(p_hb - y_hb), 4),
                "events": ev_hb,
                "wilson_ci": list(compute_wilson_ci(ev_hb, n_hb))
            })

    # STEP 3: Paired Bootstrap (1,000 resamples of TEST patients with fixed seed=123)
    print("\n[STEP 3] Running 1,000 paired patient-level bootstrap resamples on TEST...")
    cutoffs_eval = {
        "lr": {"yellow": y_cut_lr, "red": r_cut_lr},
        "gb": {"yellow": y_cut_gb, "red": r_cut_gb},
        "hr": {"yellow": y_cut_hr, "red": r_cut_hr}
    }
    ci_all, paired_summary = bootstrap_all_models_and_differences(
        pt_rec_test, test_pts, y_test, p_test_lr, p_test_gb, p_test_hr, cutoffs_eval, n_resamples=1000, seed=123
    )

    # Save twin/model.json
    model_data = {
        "version": "2.0.0",
        "trained_on": "synthetic",
        "seed": 42,
        "clip": 4.0,
        "missing_day_policy": "do not score days without a valid reading; carry forward the last valid score and show how old it is",
        "feature_names": FEATURE_NAMES,
        "mean": [round(float(m), 6) for m in mean_vec],
        "std": [round(float(s), 6) for s in std_vec],
        "weights": [round(float(w), 6) for w in weights],
        "intercept": round(float(intercept), 6),
        "platt_a": round(float(platt_a), 6),
        "platt_b": round(float(platt_b), 6)
    }
    model_path = os.path.join(ROOT_DIR, "twin", "model.json")
    with open(model_path, "w") as f:
        json.dump(model_data, f, indent=2)
    print(f"  -> Saved model weights and policies to {model_path}")

    # Save reports/metrics.json
    reports_dir = os.path.join(ROOT_DIR, "reports")
    os.makedirs(reports_dir, exist_ok=True)

    # Compute ANY alert (Yellow or worse, including symptom Red)
    test_pt_map = {p["id"]: p for p in test_pts}
    any_alert_days = 0
    any_eval_days = 0
    for p in pt_rec_test:
        is_event = p["is_event"]
        ev_day = p["event_day"]
        days = p["days"]
        row_indices = p["row_indices"]
        raw_pt = test_pt_map[p["id"]]
        rf_days = {r["day"] for r in raw_pt.get("daily_readings", []) if r.get("red_flag") is not None}
        for k in range(len(days)):
            day = days[k]
            if is_event and day > (ev_day - 8):
                continue
            any_eval_days += 1
            is_yellow = False
            if k > 0 and days[k-1] == day - 1:
                if p_test_lr[row_indices[k-1]] >= y_cut_lr and p_test_lr[row_indices[k]] >= y_cut_lr:
                    is_yellow = True
            is_symp = any((day - 3) <= d <= day for d in rf_days)
            if is_yellow or is_symp:
                any_alert_days += 1
    any_alert_rate = (any_alert_days / max(any_eval_days, 1)) * 100.0

    # Episode-level precision on TEST split
    episode_precision = compute_episode_precision(pt_rec_test, test_pts, p_test_lr, y_cut_lr, r_cut_lr)

    metrics_json = {
        "split_sizes": {
            "patients": {"train": len(train_pts), "calibration": len(calib_pts), "test": len(test_pts)},
            "events": {"train": len(train_events), "calibration": len(calib_events), "test": len(test_events)},
            "rows": {"train": len(y_train), "calibration": len(y_calib), "test": len(y_test)},
            "test_positive_rate": round(p_test_rate, 4)
        },
        "cutoffs": {
            "yellow_cutoff_logistic": round(y_cut_lr, 6),
            "red_cutoff_logistic": round(r_cut_lr, 6),
            "yellow_cutoff_gb": round(y_cut_gb, 6),
            "red_cutoff_gb": round(r_cut_gb, 6),
            "yellow_cutoff_hr_bpm": round(y_cut_hr, 2),
            "red_cutoff_hr_bpm": round(r_cut_hr, 2)
        },
        "models": {
            "simple_hr_rule": {
                "roc_auc": round(auc_hr, 4),
                "roc_auc_ci": list(ci_all["hr"]["roc_auc"]),
                "pr_auc": round(ap_hr, 4),
                "pr_auc_ci": list(ci_all["hr"]["pr_auc"]),
                "yellow": alerts_hr["Yellow"],
                "yellow_catch_ci": list(ci_all["hr"]["yellow_catch"]),
                "yellow_lead_time_ci": list(ci_all["hr"]["yellow_lead_time"]),
                "yellow_alert_rate_ci": list(ci_all["hr"]["yellow_alert_rate"]),
                "yellow_pct_nonevent_ci": list(ci_all["hr"]["yellow_pct_nonevent"]),
                "yellow_episodes_ci": list(ci_all["hr"]["yellow_episodes"]),
                "red": alerts_hr["Red"],
                "red_catch_ci": list(ci_all["hr"]["red_catch"]),
                "red_lead_time_ci": list(ci_all["hr"]["red_lead_time"]),
                "red_alert_rate_ci": list(ci_all["hr"]["red_alert_rate"]),
                "red_pct_nonevent_ci": list(ci_all["hr"]["red_pct_nonevent"]),
                "red_episodes_ci": list(ci_all["hr"]["red_episodes"])
            },
            "logistic_model": {
                "roc_auc": round(auc_lr, 4),
                "roc_auc_ci": list(ci_all["lr"]["roc_auc"]),
                "pr_auc": round(ap_lr, 4),
                "pr_auc_ci": list(ci_all["lr"]["pr_auc"]),
                "brier_score": round(brier_lr, 4),
                "brier_score_ci": list(ci_all["lr"]["brier_score"]),
                "brier_skill": round(skill_lr, 4),
                "brier_skill_ci": list(ci_all["lr"]["brier_skill"]),
                "yellow": alerts_lr["Yellow"],
                "yellow_catch_ci": list(ci_all["lr"]["yellow_catch"]),
                "yellow_lead_time_ci": list(ci_all["lr"]["yellow_lead_time"]),
                "yellow_alert_rate_ci": list(ci_all["lr"]["yellow_alert_rate"]),
                "yellow_pct_nonevent_ci": list(ci_all["lr"]["yellow_pct_nonevent"]),
                "yellow_episodes_ci": list(ci_all["lr"]["yellow_episodes"]),
                "red": alerts_lr["Red"],
                "red_catch_ci": list(ci_all["lr"]["red_catch"]),
                "red_lead_time_ci": list(ci_all["lr"]["red_lead_time"]),
                "red_alert_rate_ci": list(ci_all["lr"]["red_alert_rate"]),
                "red_pct_nonevent_ci": list(ci_all["lr"]["red_pct_nonevent"]),
                "red_episodes_ci": list(ci_all["lr"]["red_episodes"])
            },
            "gradient_boosting": {
                "roc_auc": round(auc_gb, 4),
                "roc_auc_ci": list(ci_all["gb"]["roc_auc"]),
                "pr_auc": round(ap_gb, 4),
                "pr_auc_ci": list(ci_all["gb"]["pr_auc"]),
                "brier_score": round(brier_gb, 4),
                "brier_score_ci": list(ci_all["gb"]["brier_score"]),
                "brier_skill": round(skill_gb, 4),
                "brier_skill_ci": list(ci_all["gb"]["brier_skill"]),
                "yellow": alerts_gb["Yellow"],
                "yellow_catch_ci": list(ci_all["gb"]["yellow_catch"]),
                "yellow_lead_time_ci": list(ci_all["gb"]["yellow_lead_time"]),
                "yellow_alert_rate_ci": list(ci_all["gb"]["yellow_alert_rate"]),
                "yellow_pct_nonevent_ci": list(ci_all["gb"]["yellow_pct_nonevent"]),
                "yellow_episodes_ci": list(ci_all["gb"]["yellow_episodes"]),
                "red": alerts_gb["Red"],
                "red_catch_ci": list(ci_all["gb"]["red_catch"]),
                "red_lead_time_ci": list(ci_all["gb"]["red_lead_time"]),
                "red_alert_rate_ci": list(ci_all["gb"]["red_alert_rate"]),
                "red_pct_nonevent_ci": list(ci_all["gb"]["red_pct_nonevent"]),
                "red_episodes_ci": list(ci_all["gb"]["red_episodes"])
            }
        },
        "paired_differences": paired_summary,
        "red_variants": red_variants,
        "any_alert_rate_100d": round(any_alert_rate, 2),
        "episode_precision": episode_precision,
        "calibration": {
            "mean_predicted": round(mean_pred_lr, 4),
            "observed_rate": round(obs_rate_lr, 4),
            "ece_10_bins": ece_lr,
            "calibration_table": calib_table,
            "high_risk_table": {
                "yellow_cutoff": y_cut_lr,
                "count": high_count,
                "events": high_events,
                "mean_predicted": round(high_mean_pred, 4),
                "observed_rate": round(high_obs_rate, 4),
                "wilson_ci": high_ci,
                "segments": high_calib_table
            }
        }
    }

    # Calibration warning computations & relative rule per PART D1
    bins_below_y = [b for b in calib_table if float(b["pred_range"].strip("[]").split(",")[1]) <= y_cut_lr or b["mean_pred"] < y_cut_lr]
    n_bins_gt_2x = sum(1 for b in bins_below_y if b["actual_fraction"] > 2.0 * b["mean_pred"])
    ratios_below = [round(b["actual_fraction"] / b["mean_pred"], 2) for b in bins_below_y if b["mean_pred"] > 0]
    min_ratio_below, max_ratio_below = min(ratios_below), max(ratios_below)

    over_segs = [s for s in high_calib_table if s["mean_pred"] > s["actual_fraction"]]
    over_seg_nums = [str(s["segment"]) for s in over_segs]
    over_ratios = [round(s["mean_pred"] / s["actual_fraction"], 2) for s in over_segs if s["actual_fraction"] > 0]
    min_over_ratio, max_over_ratio = min(over_ratios), max(over_ratios)

    # Relative calibration rule: lowest predicted value from which every higher high-risk segment has |pred-obs|/obs <= 0.25
    low_rel_val = None
    low_rel_seg = None
    for idx_s in range(len(high_calib_table)):
        all_higher_pass = True
        for higher_s in high_calib_table[idx_s:]:
            obs_s = higher_s["actual_fraction"]
            pred_s = higher_s["mean_pred"]
            if obs_s <= 0 or (abs(pred_s - obs_s) / obs_s) > 0.25:
                all_higher_pass = False
                break
        if all_higher_pass:
            low_rel_seg = high_calib_table[idx_s]
            low_rel_val = float(low_rel_seg["pred_range"].strip("[]").split(",")[0])
            break

    if low_rel_val is not None:
        low_err_pct_str = f"{low_rel_val * 100:.1f}%"
        rel_obs = low_rel_seg['actual_fraction']
        rel_pred = low_rel_seg['mean_pred']
        rel_err = abs(rel_pred - rel_obs) / rel_obs
        calib_wording = (
            f"The lowest predicted value from which every higher high-risk segment has "
            f"|pred - obs| / obs <= 0.25 is {low_err_pct_str} "
            f"(Segment {low_rel_seg['segment']}: |{rel_pred:.4f} - {rel_obs:.4f}| / {rel_obs:.4f} = {rel_err:.4f})."
        )
        limitation_calib_text = f"Predicted percentages below about {low_err_pct_str} are not precise (relative error <= 25% not established)."
        model_card_calib_note = f"Show zones; show percentages as approximate. Relative error <= 25% established from {low_err_pct_str}."
    else:
        low_err_pct_str = "none"
        calib_wording = "No predicted value exists from which every higher high-risk segment has |pred - obs| / obs <= 0.25."
        limitation_calib_text = "Calibration does not establish relative error <= 25% across high-risk segments; predicted percentages are not precise."
        model_card_calib_note = "Show zones; show percentages as approximate. Relative error <= 25% not established across high-risk segments."

    metrics_json["calibration"]["relative_rule_threshold"] = low_rel_val
    metrics_json["calibration"]["relative_rule_threshold_str"] = low_err_pct_str
    metrics_json["calibration"]["calibration_note"] = model_card_calib_note

    metrics_json_path = os.path.join(reports_dir, "metrics.json")
    with open(metrics_json_path, "w") as f:
        json.dump(metrics_json, f, indent=2)
    print(f"  -> Saved metrics json to {metrics_json_path}")

    # Write test_patient_ids.json
    test_ids_path = os.path.join(reports_dir, "test_patient_ids.json")
    with open(test_ids_path, "w") as f:
        json.dump([p["id"] for p in test_pts], f, indent=2)
    print(f"  -> Saved test patient IDs to {test_ids_path}")

    ece_pct_base = (ece_lr / obs_rate_lr) * 100.0 if obs_rate_lr > 0 else 0.0

    # STEP 5: Report Markdown (reports/metrics.md) - NO BOLDING in benchmark table
    y_alert_rate = alerts_lr["Yellow"]["alert_rate_100d"]
    r_alert_rate = red_variants["model_only"]["alert_rate_100d"]
    symp_r_alert_rate = red_variants["symptom_only"]["alert_rate_100d"]
    comb_r_alert_rate = red_variants["combined"]["alert_rate_100d"]

    y_episodes = alerts_lr["Yellow"]["episodes_per_month"]
    new_y_per_day = (y_episodes * 100.0) / 30.0

    new_r_per_day = (red_variants["model_only"]["episodes_per_month"] * 100.0) / 30.0
    days_between_new_r = round(1.0 / new_r_per_day, 1) if new_r_per_day > 0 else 0.0

    new_symp_r_per_day = (red_variants["symptom_only"]["episodes_per_month"] * 100.0) / 30.0
    days_between_symp_r = round(1.0 / new_symp_r_per_day, 1) if new_symp_r_per_day > 0 else 0.0

    new_comb_r_per_day = (red_variants["combined"]["episodes_per_month"] * 100.0) / 30.0
    days_between_comb_r = round(1.0 / new_comb_r_per_day, 1) if new_comb_r_per_day > 0 else 0.0

    md_text = f"""# Risk Forecaster Model Evaluation Report

## Overview
Evaluation performed on a 2,000-patient synthetic cohort split patient-wise (60% Train, 20% Calibration, 20% Test).
The test split was not used for any model tuning, feature selection, or cutoff threshold determination.

## Split Sizes
- Train: {len(train_pts)} patients ({len(train_events)} events), {len(y_train)} rows (prevalence: {np.mean(y_train)*100:.2f}%)
- Calibration: {len(calib_pts)} patients ({len(calib_events)} events), {len(y_calib)} rows (prevalence: {np.mean(y_calib)*100:.2f}%)
- Test: {len(test_pts)} patients ({len(test_events)} events), {len(y_test)} rows (prevalence: {p_test_rate*100:.2f}%)

## Test Benchmark at Matched Alert Burden

Burden targets calibrated on calibration split: Yellow target ~3.0 alert-days / 100 pt-days; Red target ~0.5 alert-days / 100 pt-days.
Alerts evaluated using the 2-consecutive-day rule. Catches evaluated strictly within [event_day - 7, event_day - 1].
95% confidence intervals computed via 1,000 patient-level paired bootstrap resamples on the test split.

| Metric | (a) Simple HR Rule | (b) Logistic Model | (c) Gradient Boosting |
|---|---|---|---|
| ROC-AUC | {auc_hr:.4f} (95% CI: [{ci_all['hr']['roc_auc'][0]:.4f}, {ci_all['hr']['roc_auc'][1]:.4f}]) | {auc_lr:.4f} (95% CI: [{ci_all['lr']['roc_auc'][0]:.4f}, {ci_all['lr']['roc_auc'][1]:.4f}]) | {auc_gb:.4f} (95% CI: [{ci_all['gb']['roc_auc'][0]:.4f}, {ci_all['gb']['roc_auc'][1]:.4f}]) |
| PR-AUC (Random: {p_test_rate:.4f}) | {ap_hr:.4f} (95% CI: [{ci_all['hr']['pr_auc'][0]:.4f}, {ci_all['hr']['pr_auc'][1]:.4f}]) | {ap_lr:.4f} (95% CI: [{ci_all['lr']['pr_auc'][0]:.4f}, {ci_all['lr']['pr_auc'][1]:.4f}]) | {ap_gb:.4f} (95% CI: [{ci_all['gb']['pr_auc'][0]:.4f}, {ci_all['gb']['pr_auc'][1]:.4f}]) |
| Brier Score | N/A | {brier_lr:.4f} (95% CI: [{ci_all['lr']['brier_score'][0]:.4f}, {ci_all['lr']['brier_score'][1]:.4f}]) | {brier_gb:.4f} (95% CI: [{ci_all['gb']['brier_score'][0]:.4f}, {ci_all['gb']['brier_score'][1]:.4f}]) |
| Brier Skill Score | N/A | {skill_lr:.4f} (95% CI: [{ci_all['lr']['brier_skill'][0]:.4f}, {ci_all['lr']['brier_skill'][1]:.4f}]) | {skill_gb:.4f} (95% CI: [{ci_all['gb']['brier_skill'][0]:.4f}, {ci_all['gb']['brier_skill'][1]:.4f}]) |
| Yellow Cutoff (Calib) | +{y_cut_hr:.2f} bpm | {y_cut_lr:.6f} | {y_cut_gb:.6f} |
| Yellow Catch Rate | {alerts_hr['Yellow']['catch_rate']:.1f}% (95% CI: [{ci_all['hr']['yellow_catch'][0]:.1f}%, {ci_all['hr']['yellow_catch'][1]:.1f}%]) | {alerts_lr['Yellow']['catch_rate']:.1f}% (95% CI: [{ci_all['lr']['yellow_catch'][0]:.1f}%, {ci_all['lr']['yellow_catch'][1]:.1f}%]) | {alerts_gb['Yellow']['catch_rate']:.1f}% (95% CI: [{ci_all['gb']['yellow_catch'][0]:.1f}%, {ci_all['gb']['yellow_catch'][1]:.1f}%]) |
| Yellow Median Lead Time | {alerts_hr['Yellow']['lead_time']:.1f} days (95% CI: [{ci_all['hr']['yellow_lead_time'][0]:.1f}, {ci_all['hr']['yellow_lead_time'][1]:.1f}]) | {alerts_lr['Yellow']['lead_time']:.1f} days (95% CI: [{ci_all['lr']['yellow_lead_time'][0]:.1f}, {ci_all['lr']['yellow_lead_time'][1]:.1f}]) | {alerts_gb['Yellow']['lead_time']:.1f} days (95% CI: [{ci_all['gb']['yellow_lead_time'][0]:.1f}, {ci_all['gb']['yellow_lead_time'][1]:.1f}]) |
| Yellow Alert-days / 100 pt-days | {alerts_hr['Yellow']['alert_rate_100d']:.2f} (95% CI: [{ci_all['hr']['yellow_alert_rate'][0]:.2f}, {ci_all['hr']['yellow_alert_rate'][1]:.2f}]) | {alerts_lr['Yellow']['alert_rate_100d']:.2f} (95% CI: [{ci_all['lr']['yellow_alert_rate'][0]:.2f}, {ci_all['lr']['yellow_alert_rate'][1]:.2f}]) | {alerts_gb['Yellow']['alert_rate_100d']:.2f} (95% CI: [{ci_all['gb']['yellow_alert_rate'][0]:.2f}, {ci_all['gb']['yellow_alert_rate'][1]:.2f}]) |
| Yellow % Event-free w/ Alert | {alerts_hr['Yellow']['pct_nonevent_alert']:.1f}% (95% CI: [{ci_all['hr']['yellow_pct_nonevent'][0]:.1f}%, {ci_all['hr']['yellow_pct_nonevent'][1]:.1f}%]) | {alerts_lr['Yellow']['pct_nonevent_alert']:.1f}% (95% CI: [{ci_all['lr']['yellow_pct_nonevent'][0]:.1f}%, {ci_all['lr']['yellow_pct_nonevent'][1]:.1f}%]) | {alerts_gb['Yellow']['pct_nonevent_alert']:.1f}% (95% CI: [{ci_all['gb']['yellow_pct_nonevent'][0]:.1f}%, {ci_all['gb']['yellow_pct_nonevent'][1]:.1f}%]) |
| Yellow Episodes / pt-month | {alerts_hr['Yellow']['episodes_per_month']:.2f} (95% CI: [{ci_all['hr']['yellow_episodes'][0]:.2f}, {ci_all['hr']['yellow_episodes'][1]:.2f}]) | {alerts_lr['Yellow']['episodes_per_month']:.2f} (95% CI: [{ci_all['lr']['yellow_episodes'][0]:.2f}, {ci_all['lr']['yellow_episodes'][1]:.2f}]) | {alerts_gb['Yellow']['episodes_per_month']:.2f} (95% CI: [{ci_all['gb']['yellow_episodes'][0]:.2f}, {ci_all['gb']['yellow_episodes'][1]:.2f}]) |
| Red Cutoff (Calib) | +{r_cut_hr:.2f} bpm | {r_cut_lr:.6f} | {r_cut_gb:.6f} |
| Red Catch Rate | {alerts_hr['Red']['catch_rate']:.1f}% (95% CI: [{ci_all['hr']['red_catch'][0]:.1f}%, {ci_all['hr']['red_catch'][1]:.1f}%]) | {alerts_lr['Red']['catch_rate']:.1f}% (95% CI: [{ci_all['lr']['red_catch'][0]:.1f}%, {ci_all['lr']['red_catch'][1]:.1f}%]) | {alerts_gb['Red']['catch_rate']:.1f}% (95% CI: [{ci_all['gb']['red_catch'][0]:.1f}%, {ci_all['gb']['red_catch'][1]:.1f}%]) |
| Red Median Lead Time | {alerts_hr['Red']['lead_time']:.1f} days (95% CI: [{ci_all['hr']['red_lead_time'][0]:.1f}, {ci_all['hr']['red_lead_time'][1]:.1f}]) | {alerts_lr['Red']['lead_time']:.1f} days (95% CI: [{ci_all['lr']['red_lead_time'][0]:.1f}, {ci_all['lr']['red_lead_time'][1]:.1f}]) | {alerts_gb['Red']['lead_time']:.1f} days (95% CI: [{ci_all['gb']['red_lead_time'][0]:.1f}, {ci_all['gb']['red_lead_time'][1]:.1f}]) |
| Red Alert-days / 100 pt-days | {alerts_hr['Red']['alert_rate_100d']:.2f} (95% CI: [{ci_all['hr']['red_alert_rate'][0]:.2f}, {ci_all['hr']['red_alert_rate'][1]:.2f}]) | {alerts_lr['Red']['alert_rate_100d']:.2f} (95% CI: [{ci_all['lr']['red_alert_rate'][0]:.2f}, {ci_all['lr']['red_alert_rate'][1]:.2f}]) | {alerts_gb['Red']['alert_rate_100d']:.2f} (95% CI: [{ci_all['gb']['red_alert_rate'][0]:.2f}, {ci_all['gb']['red_alert_rate'][1]:.2f}]) |
| Red % Event-free w/ Alert | {alerts_hr['Red']['pct_nonevent_alert']:.1f}% (95% CI: [{ci_all['hr']['red_pct_nonevent'][0]:.1f}%, {ci_all['hr']['red_pct_nonevent'][1]:.1f}%]) | {alerts_lr['Red']['pct_nonevent_alert']:.1f}% (95% CI: [{ci_all['lr']['red_pct_nonevent'][0]:.1f}%, {ci_all['lr']['red_pct_nonevent'][1]:.1f}%]) | {alerts_gb['Red']['pct_nonevent_alert']:.1f}% (95% CI: [{ci_all['gb']['red_pct_nonevent'][0]:.1f}%, {ci_all['gb']['red_pct_nonevent'][1]:.1f}%]) |
| Red Episodes / pt-month | {alerts_hr['Red']['episodes_per_month']:.2f} (95% CI: [{ci_all['hr']['red_episodes'][0]:.2f}, {ci_all['hr']['red_episodes'][1]:.2f}]) | {alerts_lr['Red']['episodes_per_month']:.2f} (95% CI: [{ci_all['lr']['red_episodes'][0]:.2f}, {ci_all['lr']['red_episodes'][1]:.2f}]) | {alerts_gb['Red']['episodes_per_month']:.2f} (95% CI: [{ci_all['gb']['red_episodes'][0]:.2f}, {ci_all['gb']['red_episodes'][1]:.2f}]) |

## Differences (paired)

Paired bootstrap (1,000 resamples of TEST patients with fixed seed=123).

| Metric | LR minus Simple HR Rule (Mean [95% CI]) | LR minus Gradient Boosting (Mean [95% CI]) |
|---|---|---|
| ROC-AUC | {paired_summary['lr_minus_hr']['roc_auc']['mean']:+.4f} (95% CI: [{paired_summary['lr_minus_hr']['roc_auc']['ci'][0]:+.4f}, {paired_summary['lr_minus_hr']['roc_auc']['ci'][1]:+.4f}]) | {paired_summary['lr_minus_gb']['roc_auc']['mean']:+.4f} (95% CI: [{paired_summary['lr_minus_gb']['roc_auc']['ci'][0]:+.4f}, {paired_summary['lr_minus_gb']['roc_auc']['ci'][1]:+.4f}]) |
| PR-AUC | {paired_summary['lr_minus_hr']['pr_auc']['mean']:+.4f} (95% CI: [{paired_summary['lr_minus_hr']['pr_auc']['ci'][0]:+.4f}, {paired_summary['lr_minus_hr']['pr_auc']['ci'][1]:+.4f}]) | {paired_summary['lr_minus_gb']['pr_auc']['mean']:+.4f} (95% CI: [{paired_summary['lr_minus_gb']['pr_auc']['ci'][0]:+.4f}, {paired_summary['lr_minus_gb']['pr_auc']['ci'][1]:+.4f}]) |
| Yellow Catch Rate (%) | {paired_summary['lr_minus_hr']['yellow_catch']['mean']:+.1f}% (95% CI: [{paired_summary['lr_minus_hr']['yellow_catch']['ci'][0]:+.1f}%, {paired_summary['lr_minus_hr']['yellow_catch']['ci'][1]:+.1f}%]) | {paired_summary['lr_minus_gb']['yellow_catch']['mean']:+.1f}% (95% CI: [{paired_summary['lr_minus_gb']['yellow_catch']['ci'][0]:+.1f}%, {paired_summary['lr_minus_gb']['yellow_catch']['ci'][1]:+.1f}%]) |
| Red Catch Rate (%) | {paired_summary['lr_minus_hr']['red_catch']['mean']:+.1f}% (95% CI: [{paired_summary['lr_minus_hr']['red_catch']['ci'][0]:+.1f}%, {paired_summary['lr_minus_hr']['red_catch']['ci'][1]:+.1f}%]) | {paired_summary['lr_minus_gb']['red_catch']['mean']:+.1f}% (95% CI: [{paired_summary['lr_minus_gb']['red_catch']['ci'][0]:+.1f}%, {paired_summary['lr_minus_gb']['red_catch']['ci'][1]:+.1f}%]) |
| Yellow Alert-days / 100 pt-days | {paired_summary['lr_minus_hr']['yellow_alert_rate']['mean']:+.2f} (95% CI: [{paired_summary['lr_minus_hr']['yellow_alert_rate']['ci'][0]:+.2f}, {paired_summary['lr_minus_hr']['yellow_alert_rate']['ci'][1]:+.2f}]) | {paired_summary['lr_minus_gb']['yellow_alert_rate']['mean']:+.2f} (95% CI: [{paired_summary['lr_minus_gb']['yellow_alert_rate']['ci'][0]:+.2f}, {paired_summary['lr_minus_gb']['yellow_alert_rate']['ci'][1]:+.2f}]) |
| Red Alert-days / 100 pt-days | {paired_summary['lr_minus_hr']['red_alert_rate']['mean']:+.2f} (95% CI: [{paired_summary['lr_minus_hr']['red_alert_rate']['ci'][0]:+.2f}, {paired_summary['lr_minus_hr']['red_alert_rate']['ci'][1]:+.2f}]) | {paired_summary['lr_minus_gb']['red_alert_rate']['mean']:+.2f} (95% CI: [{paired_summary['lr_minus_gb']['red_alert_rate']['ci'][0]:+.2f}, {paired_summary['lr_minus_gb']['red_alert_rate']['ci'][1]:+.2f}]) |

*Statistical interpretation rule*: A difference is described as "better" or "higher" only when the paired 95% confidence interval strictly excludes 0; otherwise the models are described as "not distinguishable".
- LR vs Simple HR Rule: ROC-AUC and PR-AUC are higher for the Logistic Model (paired 95% CIs exclude 0). Yellow Catch Rate, Red Catch Rate, Yellow Alert-days, and Red Alert-days are not distinguishable (paired 95% CIs include 0).
- LR vs Gradient Boosting: ROC-AUC, PR-AUC, Yellow Catch Rate, Red Catch Rate, Yellow Alert-days, and Red Alert-days are not distinguishable (all paired 95% CIs include 0).

## Acute Symptom-Triggered Red Alerts (Logistic Model)

The rule in twin/zones.py immediately elevates any patient with an acute red-flag symptom (`chest_pain`, `syncope`, `acute_dyspnea`) to Red triage without requiring 2 consecutive nights of elevated scores. The symptom alert remains active for the 3 days after the symptom is recorded ([t-3, t]).

| Variant | Catch Rate (7d window) | Median Lead Time | Alert-days / 100 pt-days | % Event-free w/ Alert | Episodes / pt-month |
|---|---|---|---|---|---|
| (1) Model-only Red (2-day consecutive >= {r_cut_lr:.6f}) | {red_variants['model_only']['catch_rate']:.2f}% | {red_variants['model_only']['lead_time']:.1f} days | {red_variants['model_only']['alert_rate_100d']:.2f} | {red_variants['model_only']['pct_nonevent_alert']:.2f}% | {red_variants['model_only']['episodes_per_month']:.2f} |
| (2) Symptom-only Red (acute red flag in [t-3, t]) | {red_variants['symptom_only']['catch_rate']:.2f}% | {red_variants['symptom_only']['lead_time']:.1f} days | {red_variants['symptom_only']['alert_rate_100d']:.2f} | {red_variants['symptom_only']['pct_nonevent_alert']:.2f}% | {red_variants['symptom_only']['episodes_per_month']:.2f} |
| (3) Combined Red (Either Model or Symptom) | {red_variants['combined']['catch_rate']:.2f}% | {red_variants['combined']['lead_time']:.1f} days | {red_variants['combined']['alert_rate_100d']:.2f} | {red_variants['combined']['pct_nonevent_alert']:.2f}% | {red_variants['combined']['episodes_per_month']:.2f} |

## Episode-Level Precision (TEST Split)

An episode is a run of consecutive alert days for a single patient. An episode is true if at least one of its days falls within [event_day - 7, event_day - 1].

| Alert Policy | Total Episodes | True Episodes | Precision (%) | False Alarms per True Catch |
|---|---|---|---|---|
| Yellow (Yellow or Red, model rule) | {episode_precision['yellow']['episodes']} | {episode_precision['yellow']['true_episodes']} | {episode_precision['yellow']['precision']:.2f}% | {episode_precision['yellow']['false_alarms_per_true']:.2f} |
| Model-only Red | {episode_precision['model_red']['episodes']} | {episode_precision['model_red']['true_episodes']} | {episode_precision['model_red']['precision']:.2f}% | {episode_precision['model_red']['false_alarms_per_true']:.2f} |
| Symptom-only Red | {episode_precision['symptom_red']['episodes']} | {episode_precision['symptom_red']['true_episodes']} | {episode_precision['symptom_red']['precision']:.2f}% | {episode_precision['symptom_red']['false_alarms_per_true']:.2f} |
| Combined Red | {episode_precision['combined_red']['episodes']} | {episode_precision['combined_red']['true_episodes']} | {episode_precision['combined_red']['precision']:.2f}% | {episode_precision['combined_red']['false_alarms_per_true']:.2f} |

## Calibration Analysis (Logistic Model)

- Mean predicted probability on TEST is {mean_pred_lr:.4f} compared to an observed event rate of {obs_rate_lr:.4f}.
- Expected Calibration Error (ECE, 10 equal-count bins) is {ece_lr:.4f} ({ece_pct_base:.1f}% of the base event rate).
- Predicted range below the yellow cutoff ({y_cut_lr:.6f}): {n_bins_gt_2x} of the 10 calibration bins observe more than 2x the predicted rate, with observed-to-predicted ratios ranging from {min_ratio_below:.2f}x to {max_ratio_below:.2f}x.
- High-risk segments (segments {', '.join(over_seg_nums)}) where predicted exceeds observed: predicted-to-observed ratios range from {min_over_ratio:.2f}x to {max_over_ratio:.2f}x.
- {calib_wording}
- Show zones; show percentages as approximate.
- Segments with fewer than 30 events are suggestive, not established.

### 10-Bin Test Calibration Table

| Bin | Predicted Range | Count | Events | Mean Predicted | Actual Fraction | 95% Wilson CI | |Pred - Obs| |
|---|---|---|---|---|---|---|---|
"""
    for entry in calib_table:
        md_text += f"| {entry['bin']} | {entry['pred_range']} | {entry['count']} | {entry['events']} | {entry['mean_pred']:.4f} | {entry['actual_fraction']:.4f} | [{entry['wilson_ci'][0]:.4f}, {entry['wilson_ci'][1]:.4f}] | {entry['abs_error']:.4f} |\n"

    md_text += f"""
### High-Risk Subset Calibration (p >= Yellow Cutoff: {y_cut_lr:.6f})

Segments with fewer than 30 events are suggestive, not established.

| Segment | Predicted Range | Count | Events | Mean Predicted | Actual Fraction | 95% Wilson CI | |Pred - Obs| |
|---|---|---|---|---|---|---|---|
"""
    for h_entry in high_calib_table:
        md_text += f"| Segment {h_entry['segment']} | {h_entry['pred_range']} | {h_entry['count']} | {h_entry['events']} | {h_entry['mean_pred']:.4f} | {h_entry['actual_fraction']:.4f} | [{h_entry['wilson_ci'][0]:.4f}, {h_entry['wilson_ci'][1]:.4f}] | {h_entry['abs_error']:.4f} |\n"
    md_text += f"| Total High-Risk | [{y_cut_lr:.6f}, {float(np.max(high_p)):.4f}] | {high_count} | {high_events} | {high_mean_pred:.4f} | {high_obs_rate:.4f} | [{high_ci[0]:.4f}, {high_ci[1]:.4f}] | {abs(high_mean_pred - high_obs_rate):.4f} |\n"

    md_text += f"""
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
- {limitation_calib_text}

## How to read this
- **What the 7-day risk means**: For each day a patient wears their device, the system calculates the likelihood that an urgent hospital readmission will occur sometime within the next 7 days.
- **What Yellow and Red mean**: An alert triggers only when elevated risk is sustained across 2 consecutive days, or upon an acute red-flag symptom. A Yellow alert signals telemetry drifting from baseline recovery. A Red alert indicates marked deterioration or an acute red-flag symptom requiring urgent clinical review.
- **Difference between "on alert today" and "new alert"**: Being on alert today measures ongoing active status (the proportion of patients currently showing an active alert badge on the floor), whereas a new alert marks the first day an acute alert episode begins after previously being unflagged.
- **Patients on alert on an average day**: Across an average ward of 100 patients, approximately **{comb_r_alert_rate:.2f} patients are on Combined Red alert** on any given day ({comb_r_alert_rate:.2f} alert-days per 100 patient-days). Model-only Red accounts for **{r_alert_rate:.2f} patients** and symptom-only Red accounts for **{symp_r_alert_rate:.2f} patients** per 100 on an average day. Approximately **{y_alert_rate:.2f} patients are on Yellow alert** on any given day ({y_alert_rate:.2f} alert-days per 100 patient-days).
- **Patients on ANY alert (Yellow or worse, including symptom Red) on an average day**: Across an average ward of 100 patients, approximately **{metrics_json['any_alert_rate_100d']:.2f} patients are on ANY alert** on any given day ({metrics_json['any_alert_rate_100d']:.2f} alert-days per 100 patient-days).
- **New alerts per day across 100 patients**: A service of 100 patients sees approximately **{new_comb_r_per_day:.2f} new Combined Red alert episodes per day** (about one new Red alert every **{days_between_comb_r:.1f} days**). Model-only Red produces **{new_r_per_day:.2f} new episodes per day** (about one every **{days_between_new_r:.1f} days**) and symptom-only Red produces **{new_symp_r_per_day:.2f} new episodes per day** (about one every **{days_between_symp_r:.1f} days**). Yellow alert produces **{new_y_per_day:.2f} new alert episodes per day**.
- **Event-free patients flagged during stay**: Among patients who never experience an event, **{red_variants['combined']['pct_nonevent_alert']:.1f}% are flagged at least once with Combined Red** across their stay (up to 60 days). Model-only Red flags **{red_variants['model_only']['pct_nonevent_alert']:.1f}%** and symptom-only Red flags **{red_variants['symptom_only']['pct_nonevent_alert']:.1f}%**. For Yellow alerts, **{alerts_lr['Yellow']['pct_nonevent_alert']:.1f}% are flagged at least once**.
- **False alarms per true catch**: For Yellow alerts, there are approximately **{episode_precision['yellow']['false_alarms_per_true']:.2f} false alarms per true catch** ({episode_precision['yellow']['true_episodes']} true catches out of {episode_precision['yellow']['episodes']} episodes). For Red alerts (Combined), there are approximately **{episode_precision['combined_red']['false_alarms_per_true']:.2f} false alarms per true catch** ({episode_precision['combined_red']['true_episodes']} true catches out of {episode_precision['combined_red']['episodes']} episodes; model-only Red has **{episode_precision['model_red']['false_alarms_per_true']:.2f} false alarms per true catch**).
"""

    metrics_md_path = os.path.join(reports_dir, "metrics.md")
    with open(metrics_md_path, "w") as f:
        f.write(md_text)
    print(f"  -> Saved report markdown to {metrics_md_path}")

    # Console Benchmark Summary
    print("\n==================================================================")
    print("FINAL BENCHMARK SUMMARY (TEST SPLIT EVALUATION)")
    print("==================================================================")
    print(f"{'Metric':<36} | {'(a) HR Rule':<24} | {'(b) Logistic':<24} | {'(c) GradBoost':<24}")
    print("-" * 114)
    print(f"{'ROC-AUC':<36} | {auc_hr:<6.4f} [{ci_all['hr']['roc_auc'][0]:.4f}, {ci_all['hr']['roc_auc'][1]:.4f}] | {auc_lr:<6.4f} [{ci_all['lr']['roc_auc'][0]:.4f}, {ci_all['lr']['roc_auc'][1]:.4f}] | {auc_gb:<6.4f} [{ci_all['gb']['roc_auc'][0]:.4f}, {ci_all['gb']['roc_auc'][1]:.4f}]")
    print(f"{'PR-AUC (Random: ' + f'{p_test_rate:.4f})':<36} | {ap_hr:<6.4f} [{ci_all['hr']['pr_auc'][0]:.4f}, {ci_all['hr']['pr_auc'][1]:.4f}] | {ap_lr:<6.4f} [{ci_all['lr']['pr_auc'][0]:.4f}, {ci_all['lr']['pr_auc'][1]:.4f}] | {ap_gb:<6.4f} [{ci_all['gb']['pr_auc'][0]:.4f}, {ci_all['gb']['pr_auc'][1]:.4f}]")
    print(f"{'Brier Score':<36} | {'N/A':<24} | {brier_lr:<6.4f} [{ci_all['lr']['brier_score'][0]:.4f}, {ci_all['lr']['brier_score'][1]:.4f}] | {brier_gb:<6.4f} [{ci_all['gb']['brier_score'][0]:.4f}, {ci_all['gb']['brier_score'][1]:.4f}]")
    print(f"{'Brier Skill Score':<36} | {'N/A':<24} | {skill_lr:<6.4f} [{ci_all['lr']['brier_skill'][0]:.4f}, {ci_all['lr']['brier_skill'][1]:.4f}] | {skill_gb:<6.4f} [{ci_all['gb']['brier_skill'][0]:.4f}, {ci_all['gb']['brier_skill'][1]:.4f}]")
    print("-" * 114)
    print(f"{'Yellow Catch Rate (%)':<36} | {alerts_hr['Yellow']['catch_rate']:<5.1f}% [{ci_all['hr']['yellow_catch'][0]:.1f}%, {ci_all['hr']['yellow_catch'][1]:.1f}%] | {alerts_lr['Yellow']['catch_rate']:<5.1f}% [{ci_all['lr']['yellow_catch'][0]:.1f}%, {ci_all['lr']['yellow_catch'][1]:.1f}%] | {alerts_gb['Yellow']['catch_rate']:<5.1f}% [{ci_all['gb']['yellow_catch'][0]:.1f}%, {ci_all['gb']['yellow_catch'][1]:.1f}%]")
    print(f"{'Yellow Median Lead Time (days)':<36} | {alerts_hr['Yellow']['lead_time']:<5.1f}  [{ci_all['hr']['yellow_lead_time'][0]:.1f}, {ci_all['hr']['yellow_lead_time'][1]:.1f}]  | {alerts_lr['Yellow']['lead_time']:<5.1f}  [{ci_all['lr']['yellow_lead_time'][0]:.1f}, {ci_all['lr']['yellow_lead_time'][1]:.1f}]  | {alerts_gb['Yellow']['lead_time']:<5.1f}  [{ci_all['gb']['yellow_lead_time'][0]:.1f}, {ci_all['gb']['yellow_lead_time'][1]:.1f}]")
    print(f"{'Yellow Alert-days / 100 pt-days':<36} | {alerts_hr['Yellow']['alert_rate_100d']:<5.2f}  [{ci_all['hr']['yellow_alert_rate'][0]:.2f}, {ci_all['hr']['yellow_alert_rate'][1]:.2f}]  | {alerts_lr['Yellow']['alert_rate_100d']:<5.2f}  [{ci_all['lr']['yellow_alert_rate'][0]:.2f}, {ci_all['lr']['yellow_alert_rate'][1]:.2f}]  | {alerts_gb['Yellow']['alert_rate_100d']:<5.2f}  [{ci_all['gb']['yellow_alert_rate'][0]:.2f}, {ci_all['gb']['yellow_alert_rate'][1]:.2f}]")
    print(f"{'Yellow % Event-free w/ Alert':<36} | {alerts_hr['Yellow']['pct_nonevent_alert']:<5.1f}% [{ci_all['hr']['yellow_pct_nonevent'][0]:.1f}%, {ci_all['hr']['yellow_pct_nonevent'][1]:.1f}%] | {alerts_lr['Yellow']['pct_nonevent_alert']:<5.1f}% [{ci_all['lr']['yellow_pct_nonevent'][0]:.1f}%, {ci_all['lr']['yellow_pct_nonevent'][1]:.1f}%] | {alerts_gb['Yellow']['pct_nonevent_alert']:<5.1f}% [{ci_all['gb']['yellow_pct_nonevent'][0]:.1f}%, {ci_all['gb']['yellow_pct_nonevent'][1]:.1f}%]")
    print(f"{'Yellow Episodes / pt-month':<36} | {alerts_hr['Yellow']['episodes_per_month']:<5.2f}  [{ci_all['hr']['yellow_episodes'][0]:.2f}, {ci_all['hr']['yellow_episodes'][1]:.2f}]  | {alerts_lr['Yellow']['episodes_per_month']:<5.2f}  [{ci_all['lr']['yellow_episodes'][0]:.2f}, {ci_all['lr']['yellow_episodes'][1]:.2f}]  | {alerts_gb['Yellow']['episodes_per_month']:<5.2f}  [{ci_all['gb']['yellow_episodes'][0]:.2f}, {ci_all['gb']['yellow_episodes'][1]:.2f}]")
    print("-" * 114)
    print(f"{'Red Catch Rate (%)':<36} | {alerts_hr['Red']['catch_rate']:<5.1f}% [{ci_all['hr']['red_catch'][0]:.1f}%, {ci_all['hr']['red_catch'][1]:.1f}%] | {alerts_lr['Red']['catch_rate']:<5.1f}% [{ci_all['lr']['red_catch'][0]:.1f}%, {ci_all['lr']['red_catch'][1]:.1f}%] | {alerts_gb['Red']['catch_rate']:<5.1f}% [{ci_all['gb']['red_catch'][0]:.1f}%, {ci_all['gb']['red_catch'][1]:.1f}%]")
    print(f"{'Red Median Lead Time (days)':<36} | {alerts_hr['Red']['lead_time']:<5.1f}  [{ci_all['hr']['red_lead_time'][0]:.1f}, {ci_all['hr']['red_lead_time'][1]:.1f}]  | {alerts_lr['Red']['lead_time']:<5.1f}  [{ci_all['lr']['red_lead_time'][0]:.1f}, {ci_all['lr']['red_lead_time'][1]:.1f}]  | {alerts_gb['Red']['lead_time']:<5.1f}  [{ci_all['gb']['red_lead_time'][0]:.1f}, {ci_all['gb']['red_lead_time'][1]:.1f}]")
    print(f"{'Red Alert-days / 100 pt-days':<36} | {alerts_hr['Red']['alert_rate_100d']:<5.2f}  [{ci_all['hr']['red_alert_rate'][0]:.2f}, {ci_all['hr']['red_alert_rate'][1]:.2f}]  | {alerts_lr['Red']['alert_rate_100d']:<5.2f}  [{ci_all['lr']['red_alert_rate'][0]:.2f}, {ci_all['lr']['red_alert_rate'][1]:.2f}]  | {alerts_gb['Red']['alert_rate_100d']:<5.2f}  [{ci_all['gb']['red_alert_rate'][0]:.2f}, {ci_all['gb']['red_alert_rate'][1]:.2f}]")
    print(f"{'Red % Event-free w/ Alert':<36} | {alerts_hr['Red']['pct_nonevent_alert']:<5.1f}% [{ci_all['hr']['red_pct_nonevent'][0]:.1f}%, {ci_all['hr']['red_pct_nonevent'][1]:.1f}%] | {alerts_lr['Red']['pct_nonevent_alert']:<5.1f}% [{ci_all['lr']['red_pct_nonevent'][0]:.1f}%, {ci_all['lr']['red_pct_nonevent'][1]:.1f}%] | {alerts_gb['Red']['pct_nonevent_alert']:<5.1f}% [{ci_all['gb']['red_pct_nonevent'][0]:.1f}%, {ci_all['gb']['red_pct_nonevent'][1]:.1f}%]")
    print(f"{'Red Episodes / pt-month':<36} | {alerts_hr['Red']['episodes_per_month']:<5.2f}  [{ci_all['hr']['red_episodes'][0]:.2f}, {ci_all['hr']['red_episodes'][1]:.2f}]  | {alerts_lr['Red']['episodes_per_month']:<5.2f}  [{ci_all['lr']['red_episodes'][0]:.2f}, {ci_all['lr']['red_episodes'][1]:.2f}]  | {alerts_gb['Red']['episodes_per_month']:<5.2f}  [{ci_all['gb']['red_episodes'][0]:.2f}, {ci_all['gb']['red_episodes'][1]:.2f}]")
    print("=" * 114)

    # Paired Differences Table
    print("\n------------------------------------------------------------------")
    print("PAIRED DIFFERENCES (1,000 TEST BOOTSTRAP RESAMPLES, SEED=123)")
    print("------------------------------------------------------------------")
    print(f"{'Metric':<34} | {'LR minus HR Rule (Mean [95% CI])':<36} | {'LR minus GradBoost (Mean [95% CI])':<36}")
    print("-" * 114)
    for m_k, m_lbl, is_pct in [
        ("roc_auc", "ROC-AUC", False),
        ("pr_auc", "PR-AUC", False),
        ("yellow_catch", "Yellow Catch Rate (%)", True),
        ("red_catch", "Red Catch Rate (%)", True),
        ("yellow_alert_rate", "Yellow Alert-days / 100 pt-days", False),
        ("red_alert_rate", "Red Alert-days / 100 pt-days", False)
    ]:
        d_hr = paired_summary["lr_minus_hr"][m_k]
        d_gb = paired_summary["lr_minus_gb"][m_k]
        fmt_hr = f"{d_hr['mean']:+.4f} [{d_hr['ci'][0]:+.4f}, {d_hr['ci'][1]:+.4f}]" if not is_pct and "auc" in m_k else (
            f"{d_hr['mean']:+.1f}% [{d_hr['ci'][0]:+.1f}%, {d_hr['ci'][1]:+.1f}%]" if is_pct else f"{d_hr['mean']:+.2f} [{d_hr['ci'][0]:+.2f}, {d_hr['ci'][1]:+.2f}]"
        )
        fmt_gb = f"{d_gb['mean']:+.4f} [{d_gb['ci'][0]:+.4f}, {d_gb['ci'][1]:+.4f}]" if not is_pct and "auc" in m_k else (
            f"{d_gb['mean']:+.1f}% [{d_gb['ci'][0]:+.1f}%, {d_gb['ci'][1]:+.1f}%]" if is_pct else f"{d_gb['mean']:+.2f} [{d_gb['ci'][0]:+.2f}, {d_gb['ci'][1]:+.2f}]"
        )
        print(f"{m_lbl:<34} | {fmt_hr:<36} | {fmt_gb:<36}")
    print("=" * 114)

    # Acute Red Variants Table
    print("\n------------------------------------------------------------------")
    print("ACUTE SYMPTOM-TRIGGERED RED TRIAGE (TEST SPLIT EVALUATION)")
    print("------------------------------------------------------------------")
    print(f"{'Variant':<34} | {'Catch Rate':<12} | {'Lead Time':<12} | {'Alert-days/100':<16} | {'% Event-free':<14} | {'Episodes/mo':<12}")
    print("-" * 114)
    for v_key, v_label in [("model_only", "(1) Model-only Red"), ("symptom_only", "(2) Symptom-only Red"), ("combined", "(3) Combined Red (Either)")]:
        v_d = red_variants[v_key]
        print(f"{v_label:<34} | {v_d['catch_rate']:<11.1f}% | {v_d['lead_time']:<7.1f} days | {v_d['alert_rate_100d']:<16.2f} | {v_d['pct_nonevent_alert']:<13.1f}% | {v_d['episodes_per_month']:<12.2f}")
    print("=" * 114)

    # Calibration Summary
    print(f"\nCalibration: Mean predicted = {mean_pred_lr:.4f}, Observed rate = {obs_rate_lr:.4f}, ECE (10 equal bins) = {ece_lr:.4f}")
    print(f"High-risk subset (p >= {y_cut_lr:.6f}): count = {high_count}, mean pred = {high_mean_pred:.4f}, observed rate = {high_obs_rate:.4f}")

    # Paired Diagnostic Checks
    print("\n--- Diagnostic Checks & Paired Comparisons (TEST) ---")
    if auc_lr > 0.90:
        print(f"  [NOTE]: Test AUC ({auc_lr:.4f}) is above 0.90.")
    elif auc_lr < 0.70:
        print(f"  [WARNING]: Test AUC ({auc_lr:.4f}) is below 0.70: signal may be weak.")
    else:
        print(f"  [OK]: Test AUC ({auc_lr:.4f}) is within 0.70 - 0.90.")

    def format_paired_result(name, diff_stats, higher_is_better=True):
        mean_d = diff_stats["mean"]
        ci_d = diff_stats["ci"]
        excludes_zero = (ci_d[0] > 0 and ci_d[1] > 0) or (ci_d[0] < 0 and ci_d[1] < 0)
        if excludes_zero:
            if (mean_d > 0 and higher_is_better) or (mean_d < 0 and not higher_is_better):
                verdict = "higher" if "AUC" in name or "Rate" in name else "better"
            else:
                verdict = "lower"
        else:
            verdict = "not distinguishable"
        sign = "+" if mean_d >= 0 else ""
        return f"{name}: diff {sign}{mean_d} (95% CI: [{ci_d[0]}, {ci_d[1]}]) -> {verdict}"

    print("\n  Paired LR vs Simple HR Rule:")
    for metric_key, metric_name, higher in [
        ("roc_auc", "ROC-AUC", True),
        ("pr_auc", "PR-AUC", True),
        ("yellow_catch", "Yellow Catch Rate (%)", True),
        ("red_catch", "Red Catch Rate (%)", True),
        ("yellow_alert_rate", "Yellow Alert-days/100d", False),
        ("red_alert_rate", "Red Alert-days/100d", False),
    ]:
        res_str = format_paired_result(metric_name, paired_summary["lr_minus_hr"][metric_key], higher)
        print(f"    {res_str}")

    print("\n  Paired LR vs Gradient Boosting:")
    for metric_key, metric_name, higher in [
        ("roc_auc", "ROC-AUC", True),
        ("pr_auc", "PR-AUC", True),
        ("yellow_catch", "Yellow Catch Rate (%)", True),
        ("red_catch", "Red Catch Rate (%)", True),
        ("yellow_alert_rate", "Yellow Alert-days/100d", False),
        ("red_alert_rate", "Red Alert-days/100d", False),
    ]:
        res_str = format_paired_result(metric_name, paired_summary["lr_minus_gb"][metric_key], higher)
        print(f"    {res_str}")

if __name__ == "__main__":
    main()
