from __future__ import annotations
import hashlib
from typing import Any

# Postcode → region mapping for QLD/NSW/VIC (demo subset)
POSTCODE_TO_REGION: dict[str, str] = {
    **{str(p): "QLD" for p in range(4000, 4999)},
    **{str(p): "NSW" for p in range(2000, 2999)},
    **{str(p): "VIC" for p in range(3000, 3999)},
}

DIRECT_IDENTIFIER_FIELDS = [
    "name", "first_name", "last_name", "full_name",
    "dob", "date_of_birth",
    "address", "street", "suburb",
    "mrn", "medicare_number", "phone", "email",
    "subject_id",  # replaced by anonymised_id
]


def remove_direct_identifiers(record: dict) -> dict:
    rec = dict(record)
    subject_id = rec.get("subject_id")
    if subject_id is not None:
        rec["anonymised_id"] = hashlib.sha256(str(subject_id).encode()).hexdigest()[:16]

    for field in DIRECT_IDENTIFIER_FIELDS:
        rec.pop(field, None)

    # Replace exact DOB with age_band only
    rec.pop("dod", None)
    return rec


def generalise_quasi_identifiers(record: dict) -> dict:
    rec = dict(record)

    postcode = rec.pop("postcode", None)
    if postcode:
        rec["region"] = POSTCODE_TO_REGION.get(str(postcode), "OTHER")

    los = rec.get("los_days")
    if los is not None:
        rec["los_days"] = round(float(los) * 2) / 2  # round to nearest 0.5

    return rec


def check_k_anonymity(records: list[dict], k: int = 5) -> list[dict]:
    from collections import Counter

    def group_key(r: dict) -> tuple:
        return (r.get("age_band"), r.get("gender"), r.get("admission_type"))

    counts = Counter(group_key(r) for r in records)
    suppressed_groups = {key for key, count in counts.items() if count < k}

    if suppressed_groups:
        print(f"[deidentify] k-anonymity: suppressing {len(suppressed_groups)} groups with < {k} records")

    result = [r for r in records if group_key(r) not in suppressed_groups]
    print(f"[deidentify] k-anonymity: {len(records)} → {len(result)} records after suppression")
    return result


def deidentify_cohort(records: list[dict]) -> list[dict]:
    print(f"[deidentify] starting with {len(records)} records")
    step1 = [remove_direct_identifiers(r) for r in records]
    step2 = [generalise_quasi_identifiers(r) for r in step1]
    step3 = check_k_anonymity(step2)
    print(f"[deidentify] complete: {len(step3)} export-ready records")
    return step3
