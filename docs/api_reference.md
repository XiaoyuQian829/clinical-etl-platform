# API Reference — ClinicalETL Platform

Base URL: `http://localhost:8000` (local) · `https://api.clinical-etl.yourdomain.com` (production)  
Interactive docs: `{base_url}/docs` (Swagger UI) · `{base_url}/redoc` (ReDoc)

All protected endpoints require `Authorization: Bearer <JWT>` header.  
Response shape: `{"status": "ok"|"error", "data": ..., "error": null|"message"}`

---

## Authentication

### POST /auth/token

Authenticate and receive a JWT access token.

**Request** (form-encoded, `Content-Type: application/x-www-form-urlencoded`)

| Field | Type | Description |
|---|---|---|
| username | string | User login name |
| password | string | User password |

**Response 200**

```json
{
  "access_token": "eyJhbGci...",
  "token_type": "bearer",
  "role": "researcher"
}
```

**Response 401** — incorrect credentials

```bash
# Example
curl -X POST http://localhost:8000/auth/token \
  -d "username=admin_user&password=admin123"
```

**Demo accounts**

| username | password | role |
|---|---|---|
| admin_user | admin123 | admin |
| researcher_user | researcher123 | researcher |
| viewer_user | viewer123 | viewer |

---

## Health

### GET /health

Health check. No auth required.

**Response 200**

```json
{"status": "ok", "timestamp": "2026-05-31T04:45:59.674430+00:00"}
```

---

## Pipeline

### POST /pipeline/run

Trigger the full ETL pipeline: extract → transform → validate → load (raw + clean layers).

**Auth required:** `admin`

**Response 200**

```json
{
  "status": "ok",
  "data": {
    "run_id": "e7c44255",
    "status": "complete",
    "started_at": "2026-05-31T04:55:00Z",
    "steps": {
      "extract": "complete",
      "transform": "complete",
      "validate": "complete",
      "load": "complete"
    },
    "records": {
      "patients": 100,
      "admissions": 275,
      "diagnoses": 4506
    }
  }
}
```

If the pipeline fails, `status` is `"failed"` and `error` contains the exception message.

---

### GET /pipeline/status/{run_id}

Poll pipeline run status by run_id.

**Auth required:** `admin` or `researcher`

**Path params**

| Param | Description |
|---|---|
| run_id | 8-char UUID prefix returned by POST /pipeline/run |

**Response 200** — same shape as POST /pipeline/run response

**Response** `{"status": "error", "error": "Run abc12345 not found"}` if run_id unknown

---

## Data

### GET /data/clean/patients

Browse the clean.patients layer. Paginated.

**Auth required:** `admin` or `researcher`

**Query params**

| Param | Type | Default | Description |
|---|---|---|---|
| limit | int (1–500) | 50 | Records per page |
| offset | int | 0 | Pagination offset |

**Response 200**

```json
{
  "status": "ok",
  "data": {
    "total": 100,
    "limit": 50,
    "offset": 0,
    "records": [
      {
        "subject_id": 10002428,
        "gender": "F",
        "anchor_age": 80,
        "anchor_year": 2155,
        "anchor_year_group": "2011 - 2013",
        "dod": null,
        "age_band": "ELDERLY",
        "data_quality_flag": "PASS",
        "created_at": "2026-05-31T04:55:00Z"
      }
    ]
  }
}
```

---

### GET /data/research/cohort

Browse the de-identified research.cohort. Filterable and paginated.

**Auth required:** all roles (`admin`, `researcher`, `viewer`)

**Query params**

| Param | Type | Default | Description |
|---|---|---|---|
| limit | int (1–500) | 50 | Records per page |
| offset | int | 0 | Pagination offset |
| age_band | string | — | Filter: PAEDIATRIC / YOUNG_ADULT / ADULT / ELDERLY |
| gender | string | — | Filter: M / F / UNKNOWN |
| admission_type | string | — | Filter: EMERGENCY / URGENT / PLANNED / etc. |

**Response 200**

```json
{
  "status": "ok",
  "data": {
    "total": 176,
    "limit": 50,
    "offset": 0,
    "records": [
      {
        "cohort_id": 1,
        "age_band": "ELDERLY",
        "gender": "F",
        "admission_type": "URGENT",
        "los_days": 9.0,
        "primary_diagnosis_code": "5723",
        "primary_diagnosis_desc": "Portal hypertension",
        "is_deidentified": true
      }
    ]
  }
}
```

Note: `subject_id` is never present in research.cohort responses.

---

## Export

### POST /export/request

Generate a de-identified CSV export of research.cohort.

Applies: SHA-256 anonymisation → quasi-identifier generalisation → k-anonymity suppression (k=5).

**Auth required:** `researcher` or `admin`

**Request body:** none

**Response 200**

```json
{
  "status": "ok",
  "data": {
    "export_id": "b4f3d39a",
    "records": 508,
    "status": "ready"
  }
}
```

The export is saved to `data/exports/export_{export_id}.csv`. Use the export_id to download.

---

### GET /export/download/{export_id}

Download a previously generated de-identified CSV.

**Auth required:** `researcher` or `admin`

**Path params**

| Param | Description |
|---|---|
| export_id | 8-char ID returned by POST /export/request |

**Response 200** — `Content-Type: text/csv`, file download

**Response 404** — export_id not found or file missing

**CSV columns**

```
cohort_id, age_band, gender, admission_type, los_days,
primary_diagnosis_code, primary_diagnosis_desc, is_deidentified,
dbt_updated_at
```

No `subject_id`, `name`, `dob`, `mrn`, or any direct identifier is present.

---

## Audit

### GET /audit/logs

Retrieve the audit trail. Filterable.

**Auth required:** `admin` only

**Query params**

| Param | Type | Default | Description |
|---|---|---|---|
| limit | int (1–1000) | 100 | Max entries returned |
| user_id | string | — | Filter by user |
| action | string | — | Filter by action name |

**Response 200**

```json
{
  "status": "ok",
  "data": {
    "total": 6,
    "logs": [
      {
        "id": 6,
        "timestamp": "2026-05-31T04:55:34Z",
        "user_id": "researcher_01",
        "role": "researcher",
        "action": "export_downloaded",
        "resource": "export/b4f3d39a",
        "ip_address": "127.0.0.1",
        "outcome": "approved",
        "detail": null
      }
    ]
  }
}
```

**Possible action values**

| Action | Triggered by |
|---|---|
| `pipeline_run` | POST /pipeline/run |
| `export_requested` | POST /export/request |
| `export_downloaded` | GET /export/download/{id} |

---

## Error Responses

| HTTP Status | Meaning |
|---|---|
| 401 Unauthorized | Missing or expired JWT token |
| 403 Forbidden | Valid token but insufficient role for this action |
| 404 Not Found | Resource (run_id, export_id) does not exist |
| 422 Unprocessable Entity | Invalid query parameter type |
| 500 Internal Server Error | Unexpected server error (check logs) |

**401 example**
```json
{"detail": "Not authenticated"}
```

**403 example**
```json
{"detail": "User viewer_user (role=Role.VIEWER) is not permitted to perform 'export_request'"}
```

---

## Quick Start (curl)

```bash
# 1. Login
TOKEN=$(curl -s -X POST http://localhost:8000/auth/token \
  -d "username=admin_user&password=admin123" | jq -r .access_token)

# 2. Run pipeline
curl -X POST http://localhost:8000/pipeline/run \
  -H "Authorization: Bearer $TOKEN"

# 3. Browse research cohort (works for viewer too)
VIEWER=$(curl -s -X POST http://localhost:8000/auth/token \
  -d "username=viewer_user&password=viewer123" | jq -r .access_token)
curl "http://localhost:8000/data/research/cohort?age_band=ELDERLY&limit=5" \
  -H "Authorization: Bearer $VIEWER"

# 4. Request and download export (researcher)
RESEARCHER=$(curl -s -X POST http://localhost:8000/auth/token \
  -d "username=researcher_user&password=researcher123" | jq -r .access_token)
EXPORT_ID=$(curl -s -X POST http://localhost:8000/export/request \
  -H "Authorization: Bearer $RESEARCHER" | jq -r .data.export_id)
curl -o export.csv "http://localhost:8000/export/download/$EXPORT_ID" \
  -H "Authorization: Bearer $RESEARCHER"

# 5. View audit log (admin only)
curl "http://localhost:8000/audit/logs" \
  -H "Authorization: Bearer $TOKEN"
```
