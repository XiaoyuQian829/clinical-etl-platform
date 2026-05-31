from __future__ import annotations
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Any


@lru_cache(maxsize=1)
def _load_icd_descriptions() -> dict[str, str]:
    """Load full ICD-9/10 code→description mapping from d_icd_diagnoses.csv.
    Keyed by icd_code (uppercased). Falls back to a minimal hardcoded dict
    if the reference file is not found.
    """
    ref_path = Path("data/raw/d_icd_diagnoses.csv")
    if not ref_path.exists():
        # Minimal fallback so the pipeline still runs without the reference file
        return {
            "I21": "Acute myocardial infarction", "I50": "Heart failure",
            "J18": "Pneumonia, unspecified organism", "I10": "Essential hypertension",
            "410": "Acute myocardial infarction", "428": "Heart failure",
            "486": "Pneumonia, organism unspecified", "250": "Diabetes mellitus",
        }
    import csv
    mapping: dict[str, str] = {}
    with open(ref_path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            code = str(row.get("icd_code", "")).strip().upper()
            title = str(row.get("long_title", "")).strip()
            if code and title:
                mapping[code] = title
    print(f"[transform] loaded {len(mapping):,} ICD descriptions from {ref_path}")
    return mapping


# Keep module-level alias so existing code that imports ICD_DESCRIPTIONS still works
ICD_DESCRIPTIONS: dict[str, str] = {}


def _age_band(age: int | None) -> str:
    if age is None:
        return "UNKNOWN"
    if age <= 17:
        return "PAEDIATRIC"
    if age <= 40:
        return "YOUNG_ADULT"
    if age <= 65:
        return "ADULT"
    return "ELDERLY"


def _quality_flag(record: dict, required_fields: list[str]) -> str:
    nulls = sum(1 for f in required_fields if record.get(f) is None)
    if nulls == 0:
        return "PASS"
    if nulls <= 2:
        return "WARN"
    return "FAIL"


def transform_patients(raw_records: list[dict]) -> list[dict]:
    gender_map = {"m": "M", "male": "M", "f": "F", "female": "F"}
    results = []
    for r in raw_records:
        rec = dict(r)
        raw_gender = str(rec.get("gender", "")).strip().lower()
        rec["gender"] = gender_map.get(raw_gender, "UNKNOWN")
        rec["age_band"] = _age_band(rec.get("anchor_age"))
        rec["data_quality_flag"] = _quality_flag(rec, ["subject_id", "gender", "anchor_age", "anchor_year"])
        results.append(rec)

    counts = {flag: sum(1 for r in results if r["data_quality_flag"] == flag) for flag in ("PASS", "WARN", "FAIL")}
    print(f"[transform] patients: total={len(results)} PASS={counts['PASS']} WARN={counts['WARN']} FAIL={counts['FAIL']}")
    return results


def _parse_dt(value: Any) -> datetime | None:
    if value is None or (isinstance(value, float) and str(value) == "nan"):
        return None
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value))
    except Exception:
        return None


def transform_admissions(raw_records: list[dict]) -> list[dict]:
    results = []
    for r in raw_records:
        rec = dict(r)
        admittime = _parse_dt(rec.get("admittime"))
        dischtime = _parse_dt(rec.get("dischtime"))
        rec["admittime"] = admittime.isoformat() if admittime else None
        rec["dischtime"] = dischtime.isoformat() if dischtime else None

        if admittime and dischtime:
            rec["los_days"] = round((dischtime - admittime).total_seconds() / 86400, 2)
        else:
            rec["los_days"] = None

        for field in ("admission_type", "race", "admission_location", "discharge_location"):
            val = rec.get(field)
            rec[field] = str(val).strip().upper() if val else None

        rec["data_quality_flag"] = _quality_flag(rec, ["hadm_id", "subject_id", "admittime", "admission_type"])
        results.append(rec)

    counts = {flag: sum(1 for r in results if r["data_quality_flag"] == flag) for flag in ("PASS", "WARN", "FAIL")}
    print(f"[transform] admissions: total={len(results)} PASS={counts['PASS']} WARN={counts['WARN']} FAIL={counts['FAIL']}")
    return results


def transform_diagnoses(raw_records: list[dict]) -> list[dict]:
    icd_map = _load_icd_descriptions()
    results = []
    for r in raw_records:
        rec = dict(r)
        code = rec.get("icd_code")
        if code:
            code = str(code).strip().upper()
            rec["icd_code"] = code
            # exact match first, then prefix fallback for truncated codes
            desc = icd_map.get(code)
            if not desc:
                for k in icd_map:
                    if code.startswith(k) or k.startswith(code):
                        desc = icd_map[k]
                        break
            rec["icd_description"] = desc or "Unknown"
            rec["is_valid_code"] = len(code) >= 3
        else:
            rec["icd_code"] = None
            rec["icd_description"] = None
            rec["is_valid_code"] = False

        results.append(rec)

    valid_count = sum(1 for r in results if r["is_valid_code"])
    print(f"[transform] diagnoses: total={len(results)} valid_codes={valid_count} invalid={len(results)-valid_count}")
    return results
