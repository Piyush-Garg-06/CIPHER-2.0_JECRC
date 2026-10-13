"""
Model Card Generation & Serving
Built from twin/model.json, reports/metrics.json, and reports/metrics.md.
"""

import os
import json
import re
from typing import Dict, Any, Optional

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load_model_card() -> Optional[Dict[str, Any]]:
    """
    Builds model card dictionary from files on disk.
    Returns None if reports or model files are missing.
    """
    model_path = os.path.join(ROOT_DIR, "twin", "model.json")
    metrics_json_path = os.path.join(ROOT_DIR, "reports", "metrics.json")
    metrics_md_path = os.path.join(ROOT_DIR, "reports", "metrics.md")

    if not (os.path.exists(model_path) and os.path.exists(metrics_json_path) and os.path.exists(metrics_md_path)):
        return None

    try:
        with open(model_path, "r", encoding="utf-8") as f:
            model_data = json.load(f)
        with open(metrics_json_path, "r", encoding="utf-8") as f:
            metrics_data = json.load(f)
        with open(metrics_md_path, "r", encoding="utf-8") as f:
            md_text = f.read()
    except Exception:
        return None

    # Parse limitations from metrics.md
    limitations = []
    if "## Limitations" in md_text:
        lim_section = md_text.split("## Limitations")[1].split("##")[0]
        for line in lim_section.splitlines():
            line_str = line.strip()
            if line_str.startswith("- "):
                limitations.append(line_str[2:].strip())

    lm = metrics_data.get("models", {}).get("logistic_model", {})

    roc_auc_val = lm.get("roc_auc")
    roc_auc_ci = lm.get("roc_auc_ci")
    roc_auc_dict = {
        "mean": roc_auc_val,
        "ci": roc_auc_ci
    } if roc_auc_val is not None else None

    pr_auc_val = lm.get("pr_auc")
    pr_auc_ci = lm.get("pr_auc_ci")
    pr_auc_dict = {
        "mean": pr_auc_val,
        "ci": pr_auc_ci
    } if pr_auc_val is not None else None

    yellow_catch = lm.get("yellow", {}).get("catch_rate")
    yellow_catch_ci = lm.get("yellow_catch_ci")
    yellow_catch_obj = {
        "rate": yellow_catch,
        "ci": yellow_catch_ci
    } if yellow_catch is not None else None

    red_catch = lm.get("red", {}).get("catch_rate")
    red_catch_ci = lm.get("red_catch_ci")
    red_catch_obj = {
        "rate": red_catch,
        "ci": red_catch_ci
    } if red_catch is not None else None

    cutoffs_path = os.path.join(ROOT_DIR, "twin", "zone_cutoffs.json")
    yellow_cutoff = None
    red_cutoff = None
    if os.path.exists(cutoffs_path):
        try:
            with open(cutoffs_path, "r", encoding="utf-8") as f:
                cutoffs_data = json.load(f)
                yellow_cutoff = cutoffs_data.get("yellow_cutoff")
                red_cutoff = cutoffs_data.get("red_cutoff")
        except Exception:
            pass

    rv = metrics_data.get("red_variants", {})
    yellow_alert_rate = lm.get("yellow", {}).get("alert_rate_100d")
    model_red_alert_rate = rv.get("model_only", {}).get("alert_rate_100d", lm.get("red", {}).get("alert_rate_100d"))
    combined_red_alert_rate = rv.get("combined", {}).get("alert_rate_100d")

    combined_catch = rv.get("combined", {}).get("catch_rate")
    symptom_catch = rv.get("symptom_only", {}).get("catch_rate")

    calib_note = metrics_data.get("calibration", {}).get("calibration_note", "Show zones; show percentages as approximate.")

    return {
        "modelVersion": model_data.get("version"),
        "trainedOn": model_data.get("trained_on"),
        "horizonDays": 7,
        "testPositiveRate": metrics_data.get("split_sizes", {}).get("test_positive_rate"),
        "rocAuc": roc_auc_dict,
        "prAuc": pr_auc_dict,
        "yellowCatchRate": yellow_catch_obj,
        "modelRedCatchRate": red_catch_obj,
        "redCatchRate": red_catch_obj,  # preserved for backward compatibility
        "combinedRedCatchRate": {
            "rate": combined_catch,
            "ci": None
        } if combined_catch is not None else None,
        "symptomRedCatchRate": {
            "rate": symptom_catch,
            "ci": None
        } if symptom_catch is not None else None,
        "yellowAlertDaysPer100": yellow_alert_rate,
        "modelRedAlertDaysPer100": model_red_alert_rate,
        "combinedRedAlertDaysPer100": combined_red_alert_rate,
        "yellowCutoff": yellow_cutoff,
        "redCutoff": red_cutoff,
        "productRedNote": "Product Red = model Red or symptom Red",
        "redNote": "Product Red = model Red or symptom Red",
        "episodePrecision": metrics_data.get("episode_precision"),
        "calibrationNote": calib_note,
        "limitations": limitations,
        "syntheticOnly": True
    }
