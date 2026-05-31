from __future__ import annotations
from fastapi import APIRouter, Depends, Query
from governance.rbac import User
from governance.audit import get_audit_logs
from api.middleware.auth import require_role
from api.schemas.response import ok
from etl.load import get_engine

router = APIRouter(prefix="/audit", tags=["Audit"])


@router.get("/logs")
def list_audit_logs(
    limit:   int       = Query(100, ge=1, le=1000),
    user_id: str | None = Query(None),
    action:  str | None = Query(None),
    user: User = Depends(require_role("audit_read")),
):
    engine = get_engine()
    logs = get_audit_logs(engine, limit=limit, user_id=user_id, action=action)
    return ok({"total": len(logs), "logs": logs})
