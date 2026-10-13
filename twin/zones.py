"""
Stage 4 Deterministic Zone State Machine & Clinical Episode Logic

Evaluates triage zones matching the offline evaluation policy:
- Red and Yellow alerts require 2 consecutive adjacent days (gap exactly 1) >= cutoff.
- Single day >= yellow cutoff returns Green zone with watch=True.
- Acute red-flag symptoms recorded within the last 3 days ([current_day - 3, current_day])
  trigger immediate Red triage.
- Missing or invalid cutoffs configuration raises an exception.
"""

import os
import json
from typing import Dict, Any, List, Tuple, Optional, Union

class TriageZoneStateMachine:
    """
    Stage 4: Deterministic Zone State Machine with Temporal Hysteresis.
    Loads calibrated cutoffs from twin/zone_cutoffs.json.
    """

    def __init__(self, cutoffs_path: Optional[str] = None):
        if cutoffs_path is None:
            cutoffs_path = os.path.join(os.path.dirname(__file__), "zone_cutoffs.json")

        if not os.path.exists(cutoffs_path):
            raise FileNotFoundError(f"Zone cutoffs file not found: {cutoffs_path}")

        with open(cutoffs_path, "r") as f:
            config = json.load(f)

        if "yellow_cutoff" not in config or "red_cutoff" not in config:
            raise ValueError(f"Invalid zone cutoffs file: missing yellow_cutoff or red_cutoff in {cutoffs_path}")

        self.yellow_cutoff = float(config["yellow_cutoff"])
        self.red_cutoff = float(config["red_cutoff"])
        self.hysteresis_nights = int(config.get("hysteresis_nights", 2))
        self.dedup_hours = int(config.get("dedup_hours", 72))

    def evaluate_triage_state(
        self,
        is_calibrated: bool,
        recent_scores: List[Tuple[int, float]],
        acute_red_flags: List[Dict[str, Any]],
        patient_id: str,
        current_day: int
    ) -> Dict[str, Any]:
        """
        Evaluates current triage zone, active episodes, and explanatory clinical rationale.

        Args:
            is_calibrated: Whether baseline lock has been reached.
            recent_scores: List of (day, p50) tuples for valid reading days. Plain float lists raise TypeError.
            acute_red_flags: List of acute symptom dicts containing 'day' and 'type' or 'red_flag'.
            patient_id: Unique patient identifier.
            current_day: Current evaluation day.

        Returns:
            Dict containing zone, risk_tier, watch, red_source, active_episode, rationale.
        """
        if recent_scores is not None and len(recent_scores) > 0:
            first_elem = recent_scores[0]
            if not (isinstance(first_elem, (tuple, list)) and len(first_elem) == 2):
                raise TypeError(
                    f"recent_scores must be a list of (day, p50) tuples for valid days, "
                    f"got elements of type {type(first_elem).__name__}"
                )

        if not is_calibrated or not recent_scores:
            return {
                "zone": "not_calibrated",
                "risk_tier": "Not calibrated",
                "watch": False,
                "red_source": None,
                "active_episode": None,
                "rationale": "Patient has fewer than 3 valid baseline resting HR readings. Predictions withheld to prevent false alarms."
            }

        # Check for active acute red-flag symptoms within [current_day - dedup_days, current_day]
        dedup_days = int(self.dedup_hours / 24)
        flags = [f for f in (acute_red_flags or []) if f.get("day", current_day) <= current_day]
        flags.sort(key=lambda f: f.get("day", current_day))

        # Chain flags within dedup_hours (72h = 3 days) into single clinical episodes
        episodes = []
        current_chain = []
        for f in flags:
            f_day = f.get("day", current_day)
            if not current_chain:
                current_chain.append(f)
            else:
                prev_day = current_chain[-1].get("day", current_day)
                if (f_day - prev_day) <= dedup_days:
                    current_chain.append(f)
                else:
                    episodes.append(current_chain)
                    current_chain = [f]
        if current_chain:
            episodes.append(current_chain)

        # Check for active episode at current_day
        symptom_red = False
        active_episode = None
        symptom_desc = ""

        for chain in reversed(episodes):
            latest_flag = chain[-1]
            l_day = latest_flag.get("day", current_day)
            if 0 <= (current_day - l_day) <= dedup_days:
                symptom_red = True
                earliest_flag = chain[0]
                e_day = earliest_flag.get("day", current_day)
                flag_type = latest_flag.get("type") or latest_flag.get("red_flag", "acute_symptom")
                episode_id = f"V2-{patient_id}-EP-D{e_day}"
                is_dedup = (len(chain) > 1)
                active_episode = {
                    "id": episode_id,
                    "trigger": flag_type,
                    "day": l_day,
                    "deduplicated": is_dedup
                }
                symptom_desc = f"{flag_type} on day {l_day}"
                break

        # Evaluate model 2-consecutive adjacent days hysteresis
        model_red = False
        model_yellow = False
        if len(recent_scores) >= self.hysteresis_nights:
            trailing = recent_scores[-self.hysteresis_nights:]
            # Check adjacent days: each day gap exactly 1
            is_adjacent = all(trailing[i+1][0] - trailing[i][0] == 1 for i in range(len(trailing) - 1))
            if is_adjacent:
                if all(score >= self.red_cutoff for _, score in trailing):
                    model_red = True
                elif all(score >= self.yellow_cutoff for _, score in trailing):
                    model_yellow = True

        latest_p50 = recent_scores[-1][1]

        # Check Red (check red before yellow)
        if symptom_red or model_red:
            if symptom_red and model_red:
                red_source = "both"
                rationale = (
                    f"Combined Red Zone: 2 consecutive nights above Red threshold ({latest_p50*100:.1f}% >= "
                    f"{self.red_cutoff*100:.2f}%) and acute symptom ({symptom_desc}). Clinical review required."
                )
            elif symptom_red:
                red_source = "symptom"
                rationale = f"Immediate Red Zone triggered by acute symptom: {symptom_desc}. Clinical review required."
            else:
                red_source = "model"
                rationale = f"2 consecutive nights above Red threshold ({latest_p50*100:.1f}% >= {self.red_cutoff*100:.2f}%)."

            return {
                "zone": "red",
                "risk_tier": "Critical Red Flag" if symptom_red else "Red High Risk",
                "watch": False,
                "red_source": red_source,
                "active_episode": active_episode,
                "rationale": rationale
            }

        # Check Yellow
        if model_yellow:
            return {
                "zone": "yellow",
                "risk_tier": "Yellow Elevated",
                "watch": False,
                "red_source": None,
                "active_episode": None,
                "rationale": f"2 consecutive nights above Yellow threshold ({latest_p50*100:.1f}% >= {self.yellow_cutoff*100:.2f}%)."
            }

        # Check single day above Yellow cutoff -> green + watch
        if latest_p50 >= self.yellow_cutoff:
            return {
                "zone": "green",
                "risk_tier": "Green Stable",
                "watch": True,
                "red_source": None,
                "active_episode": None,
                "rationale": "single day above threshold, not an alert"
            }

        # Stable Green
        return {
            "zone": "green",
            "risk_tier": "Green Stable",
            "watch": False,
            "red_source": None,
            "active_episode": None,
            "rationale": f"Physiological markers within healthy recovery threshold ({latest_p50*100:.1f}% < {self.yellow_cutoff*100:.2f}%)."
        }
