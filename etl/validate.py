from __future__ import annotations
from datetime import datetime, timezone
from typing import Any
from pydantic import ValidationError

from models.patient import PatientRaw
from models.admission import AdmissionRaw
from models.diagnosis import DiagnosisRaw


def validate_patients(records: list[dict]) -> tuple[list[dict], list[dict]]:
    valid, invalid = [], []
    for rec in records:
        try:
            PatientRaw.model_validate(rec)
            valid.append(rec)
        except ValidationError as e:
            rec["_validation_errors"] = str(e)
            invalid.append(rec)
    return valid, invalid


def validate_admissions(records: list[dict]) -> tuple[list[dict], list[dict]]:
    valid, invalid = [], []
    for rec in records:
        try:
            AdmissionRaw.model_validate(rec)
            valid.append(rec)
        except ValidationError as e:
            rec["_validation_errors"] = str(e)
            invalid.append(rec)
    return valid, invalid


def validate_diagnoses(records: list[dict]) -> tuple[list[dict], list[dict]]:
    valid, invalid = [], []
    for rec in records:
        try:
            DiagnosisRaw.model_validate(rec)
            valid.append(rec)
        except ValidationError as e:
            rec["_validation_errors"] = str(e)
            invalid.append(rec)
    return valid, invalid


def check_duplicate_patients(records: list[dict]) -> list[int]:
    seen: dict[int, int] = {}
    for rec in records:
        sid = rec.get("subject_id")
        if sid is not None:
            seen[sid] = seen.get(sid, 0) + 1
    duplicates = [sid for sid, count in seen.items() if count > 1]
    if duplicates:
        print(f"[validate] duplicate subject_ids: {duplicates}")
    return duplicates


def check_consent_flags(records: list[dict]) -> list[dict]:
    # Placeholder: in production this would check a consent registry.
    # For demo, all MIMIC-IV records are consented under PhysioNet licence.
    for rec in records:
        rec["consent_ok"] = True
    return records


def generate_validation_report(entity: str, valid: list, invalid: list) -> dict:
    invalid_ids = [r.get("subject_id") or r.get("hadm_id") for r in invalid]
    report = {
        "entity": entity,
        "total": len(valid) + len(invalid),
        "valid_count": len(valid),
        "invalid_count": len(invalid),
        "invalid_ids": invalid_ids,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    print(
        f"[validate] {entity}: total={report['total']} "
        f"valid={report['valid_count']} invalid={report['invalid_count']}"
    )
    if invalid_ids:
        print(f"[validate] invalid ids: {invalid_ids[:10]}{'...' if len(invalid_ids) > 10 else ''}")
    return report
