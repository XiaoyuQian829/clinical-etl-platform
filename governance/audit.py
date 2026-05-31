from __future__ import annotations
from datetime import datetime, timezone
from typing import Any, Literal, Optional
from pydantic import BaseModel
from sqlalchemy import text, Engine


class AuditEntry(BaseModel):
    user_id:    str
    role:       str
    action:     str
    resource:   str
    ip_address: str = "unknown"
    outcome:    Literal["approved", "denied", "error"]
    detail:     Optional[dict] = None


def log_action(entry: AuditEntry, engine: Engine) -> None:
    ts = datetime.now(timezone.utc)
    stmt = text(
        "INSERT INTO public.audit_logs "
        "(timestamp, user_id, role, action, resource, ip_address, outcome, detail) "
        "VALUES (:ts, :user_id, :role, :action, :resource, :ip_address, :outcome, CAST(:detail AS jsonb))"
    )
    import json
    params = {
        "ts":         ts,
        "user_id":    entry.user_id,
        "role":       entry.role,
        "action":     entry.action,
        "resource":   entry.resource,
        "ip_address": entry.ip_address,
        "outcome":    entry.outcome,
        "detail":     json.dumps(entry.detail) if entry.detail else None,
    }
    try:
        with engine.begin() as conn:
            conn.execute(stmt, params)
        print(
            f"[audit] {ts.isoformat()} | user={entry.user_id} role={entry.role} "
            f"action={entry.action} resource={entry.resource} outcome={entry.outcome}"
        )
    except Exception as e:
        print(f"[audit] ERROR writing audit log: {e}")


def get_audit_logs(
    engine: Engine,
    limit: int = 100,
    user_id: str | None = None,
    action:  str | None = None,
) -> list[dict]:
    conditions = []
    params: dict[str, Any] = {"limit": limit}

    if user_id:
        conditions.append("user_id = :user_id")
        params["user_id"] = user_id
    if action:
        conditions.append("action = :action")
        params["action"] = action

    where = "WHERE " + " AND ".join(conditions) if conditions else ""
    stmt = text(
        f"SELECT id, timestamp, user_id, role, action, resource, ip_address, outcome, detail "
        f"FROM public.audit_logs {where} ORDER BY timestamp DESC LIMIT :limit"
    )

    with engine.connect() as conn:
        rows = conn.execute(stmt, params).mappings().all()

    return [dict(row) for row in rows]
