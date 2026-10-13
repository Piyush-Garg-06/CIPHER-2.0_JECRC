"""
Test Report Consistency:
Verifies that the paired-difference table in reports/metrics.md is faithfully
generated from metrics.json["paired_differences"].
"""

import os
import json
import re

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def format_table_from_metrics(paired_summary):
    header = [
        "| Metric | LR minus Simple HR Rule (Mean [95% CI]) | LR minus Gradient Boosting (Mean [95% CI]) |",
        "|---|---|---|"
    ]
    rows = [
        ("roc_auc", "ROC-AUC", False),
        ("pr_auc", "PR-AUC", False),
        ("yellow_catch", "Yellow Catch Rate (%)", True),
        ("red_catch", "Red Catch Rate (%)", True),
        ("yellow_alert_rate", "Yellow Alert-days / 100 pt-days", False),
        ("red_alert_rate", "Red Alert-days / 100 pt-days", False)
    ]
    table_lines = list(header)
    for key, label, is_pct in rows:
        hr = paired_summary["lr_minus_hr"][key]
        gb = paired_summary["lr_minus_gb"][key]
        if "auc" in key:
            hr_str = f"{hr['mean']:+.4f} (95% CI: [{hr['ci'][0]:+.4f}, {hr['ci'][1]:+.4f}])"
            gb_str = f"{gb['mean']:+.4f} (95% CI: [{gb['ci'][0]:+.4f}, {gb['ci'][1]:+.4f}])"
        elif is_pct:
            hr_str = f"{hr['mean']:+.1f}% (95% CI: [{hr['ci'][0]:+.1f}%, {hr['ci'][1]:+.1f}%])"
            gb_str = f"{gb['mean']:+.1f}% (95% CI: [{gb['ci'][0]:+.1f}%, {gb['ci'][1]:+.1f}%])"
        else:
            hr_str = f"{hr['mean']:+.2f} (95% CI: [{hr['ci'][0]:+.2f}, {hr['ci'][1]:+.2f}])"
            gb_str = f"{gb['mean']:+.2f} (95% CI: [{gb['ci'][0]:+.2f}, {gb['ci'][1]:+.2f}])"
        table_lines.append(f"| {label} | {hr_str} | {gb_str} |")
    return table_lines


def test_paired_difference_table_matches_metrics_json():
    metrics_json_path = os.path.join(ROOT_DIR, "reports", "metrics.json")
    metrics_md_path = os.path.join(ROOT_DIR, "reports", "metrics.md")

    assert os.path.exists(metrics_json_path), f"Missing {metrics_json_path}"
    assert os.path.exists(metrics_md_path), f"Missing {metrics_md_path}"

    with open(metrics_json_path, "r", encoding="utf-8") as f:
        metrics = json.load(f)

    with open(metrics_md_path, "r", encoding="utf-8") as f:
        md_text = f.read()

    expected_lines = format_table_from_metrics(metrics["paired_differences"])

    # Extract the table lines from metrics.md
    # Look for the section "## Differences (paired)"
    assert "## Differences (paired)" in md_text, "Missing '## Differences (paired)' in metrics.md"
    section = md_text.split("## Differences (paired)")[1].split("##")[0]

    md_table_lines = [line.strip() for line in section.strip().splitlines() if line.strip().startswith("|")]

    assert len(md_table_lines) == len(expected_lines), (
        f"Table line count mismatch: expected {len(expected_lines)}, got {len(md_table_lines)}"
    )

    for i, (exp, act) in enumerate(zip(expected_lines, md_table_lines)):
        assert act == exp, (
            f"Table row {i} mismatch:\nExpected: {exp}\nActual:   {act}"
        )


def test_model_card_calibration_established_from_p():
    from api.model_card import load_model_card
    card = load_model_card()
    assert card is not None
    assert "calibrationEstablishedFromP" in card
    assert isinstance(card["calibrationEstablishedFromP"], (int, float))
    assert abs(card["calibrationEstablishedFromP"] - 0.0941) < 0.001
