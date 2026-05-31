from __future__ import annotations
from dynamodb.fhir_ingest import get_fhir_by_subject_id, get_table


def list_all_subjects(limit: int = 100) -> list[str]:
    table = get_table()
    response = table.scan(
        ProjectionExpression="subject_id",
        Limit=limit,
    )
    items = response.get("Items", [])
    ids = [item["subject_id"] for item in items]
    print(f"[dynamodb] Found {len(ids)} subjects")
    return ids


def query_fhir_patient(subject_id: str) -> dict | None:
    return get_fhir_by_subject_id(subject_id)
