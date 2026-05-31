# RBAC Policy — ClinicalETL Platform

Role-based access control definitions, permission matrix, and enforcement implementation.

---

## Roles

| Role | Description | Who Gets This |
|---|---|---|
| `admin` | Full platform access including pipeline control and audit log | Data engineers, platform administrators |
| `researcher` | Read access to clean and research layers; can request exports | Clinical researchers, data analysts |
| `viewer` | Read-only access to the de-identified research layer only | External reviewers, stakeholders |

---

## Permission Matrix

| Action | admin | researcher | viewer |
|---|:---:|:---:|:---:|
| `pipeline_run` | ✅ | ❌ | ❌ |
| `pipeline_status` | ✅ | ✅ | ❌ |
| `data_read_raw` | ✅ | ❌ | ❌ |
| `data_read_clean` | ✅ | ✅ | ❌ |
| `data_read_research` | ✅ | ✅ | ✅ |
| `export_request` | ✅ | ✅ | ❌ |
| `export_download` | ✅ | ✅ | ❌ |
| `audit_read` | ✅ | ❌ | ❌ |
| `user_management` | ✅ | ❌ | ❌ |

---

## API Endpoint → Permission Mapping

| Endpoint | Method | Required Permission |
|---|---|---|
| /pipeline/run | POST | `pipeline_run` |
| /pipeline/status/{run_id} | GET | `pipeline_status` |
| /data/clean/patients | GET | `data_read_clean` |
| /data/research/cohort | GET | `data_read_research` |
| /export/request | POST | `export_request` |
| /export/download/{id} | GET | `export_download` |
| /audit/logs | GET | `audit_read` |
| /auth/token | POST | — (public) |
| /health | GET | — (public) |

---

## Demo Credentials

| Username | Password | Role |
|---|---|---|
| `admin_user` | `admin123` | admin |
| `researcher_user` | `researcher123` | researcher |
| `viewer_user` | `viewer123` | viewer |

> These are hardcoded in-memory for the demo. In production, replace with a database-backed user store and bcrypt hashing.

---

## Implementation

### governance/rbac.py

```python
class Role(str, Enum):
    ADMIN      = "admin"
    RESEARCHER = "researcher"
    VIEWER     = "viewer"

PERMISSIONS: dict[Role, list[str]] = {
    Role.ADMIN:      ["user_management", "audit_read", "pipeline_run", ...],
    Role.RESEARCHER: ["pipeline_status", "data_read_clean", ...],
    Role.VIEWER:     ["data_read_research"],
}

def check_permission(user: User, action: str) -> bool:
    if action not in PERMISSIONS[user.role]:
        raise PermissionError(f"{user.username} ({user.role}) cannot '{action}'")
    return True
```

### API Enforcement (api/middleware/auth.py)

Every protected endpoint uses a FastAPI dependency:

```python
def require_role(required_action: str):
    def dependency(user: User = Depends(get_current_user)) -> User:
        try:
            check_permission(user, required_action)
        except PermissionError as e:
            raise HTTPException(status_code=403, detail=str(e))
        return user
    return dependency

# Usage in router:
@router.get("/audit/logs")
def list_audit_logs(user: User = Depends(require_role("audit_read"))):
    ...
```

### JWT Token

- Algorithm: HS256
- Expiry: 60 minutes (configurable via `JWT_EXPIRE_MINUTES` env var)
- Payload: `{"sub": username, "role": role, "exp": timestamp}`
- Invalid or expired token → HTTP 401
- Valid token but insufficient role → HTTP 403

---

## Audit Trail

Every permission-gated action is written to `public.audit_logs` with:

```json
{
  "user_id": "researcher_01",
  "role":    "researcher",
  "action":  "export_requested",
  "resource":"research.cohort",
  "ip_address": "203.0.113.42",
  "outcome": "approved",
  "detail":  {"export_id": "b4f3d39a", "record_count": 508}
}
```

Denied actions (403) are also logged with `"outcome": "denied"` so that failed access attempts are visible to admins.

---

## Data Layer Access by Role

| Layer | Table | admin | researcher | viewer |
|---|---|:---:|:---:|:---:|
| raw | raw.patients | ✅ via API | ❌ | ❌ |
| raw | raw.admissions | ✅ via API | ❌ | ❌ |
| raw | raw.diagnoses | ✅ via API | ❌ | ❌ |
| raw | raw.icd_reference | ✅ | ✅ (indirect via clean) | ❌ |
| clean | clean.patients | ✅ | ✅ | ❌ |
| clean | clean.admissions | ✅ | ✅ | ❌ |
| clean | clean.diagnoses | ✅ | ✅ | ❌ |
| research | research.cohort | ✅ | ✅ | ✅ |
| research | research.outcomes | ✅ | ✅ | ✅ |
| public | audit_logs | ✅ (read) | ❌ | ❌ |

Note: `research.*` tables never contain `subject_id` — they are de-identified by construction regardless of who queries them.

---

## Future Enhancements (Production)

- Replace in-memory user dict with PostgreSQL `users` table
- Add bcrypt (or argon2id) password hashing
- Implement token refresh with short-lived access + long-lived refresh tokens
- Add field-level access control (e.g. age vs age_band visibility)
- Integrate with institutional SSO (SAML / OAuth2 with Azure AD)
- Implement consent registry check in `governance/consent.py`
