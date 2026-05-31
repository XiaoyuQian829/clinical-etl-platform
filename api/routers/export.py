from __future__ import annotations
import csv
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from sqlalchemy import text
from governance.rbac import User
from governance.audit import AuditEntry, log_action
from api.middleware.auth import require_role
from api.schemas.response import ok, err
from etl.load import get_engine
from etl.deidentify import deidentify_cohort

router = APIRouter(prefix="/export", tags=["Export"])

EXPORTS_DIR = Path("data/exports")
EXPORTS_DIR.mkdir(parents=True, exist_ok=True)

_exports: dict[str, dict] = {}


@router.post("/request")
def request_export(request: Request, user: User = Depends(require_role("export_request"))):
    engine = get_engine()
    with engine.connect() as conn:
        rows = conn.execute(text("SELECT * FROM research.cohort ORDER BY cohort_id")).mappings().all()

    records = [dict(r) for r in rows]
    deidentified = deidentify_cohort(records)

    export_id = str(uuid.uuid4())[:8]
    filepath = EXPORTS_DIR / f"export_{export_id}.csv"

    if deidentified:
        fieldnames = list(deidentified[0].keys())
        with open(filepath, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(deidentified)

    _exports[export_id] = {
        "export_id": export_id,
        "filepath":  str(filepath),
        "records":   len(deidentified),
        "requested_by": user.username,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "ready",
    }

    log_action(AuditEntry(
        user_id=user.user_id, role=user.role, action="export_requested",
        resource="research.cohort",
        ip_address=request.client.host if request.client else "unknown",
        outcome="approved",
        detail={"export_id": export_id, "record_count": len(deidentified)},
    ), engine)

    print(f"[export] created {filepath} ({len(deidentified)} records)")
    return ok({"export_id": export_id, "records": len(deidentified), "status": "ready"})


@router.get("/download/{export_id}")
def download_export(export_id: str, request: Request, user: User = Depends(require_role("export_download"))):
    meta = _exports.get(export_id)
    if not meta:
        raise HTTPException(status_code=404, detail=f"Export {export_id} not found")

    filepath = Path(meta["filepath"])
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Export file not found on disk")

    log_action(AuditEntry(
        user_id=user.user_id, role=user.role, action="export_downloaded",
        resource=f"export/{export_id}",
        ip_address=request.client.host if request.client else "unknown",
        outcome="approved",
    ), get_engine())

    return FileResponse(
        path=str(filepath),
        media_type="text/csv",
        filename=filepath.name,
    )
