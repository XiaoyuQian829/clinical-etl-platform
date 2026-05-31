# Architecture — ClinicalETL Platform

## Overview

ClinicalETL is a layered clinical data platform built around three concerns:

1. **Ingestion** — raw EMR data (CSV + FHIR JSON) → PostgreSQL raw layer
2. **Governance** — RBAC, JWT auth, full audit trail, de-identification
3. **Research access** — governed API, cohort browser, de-identified CSV export

---

## Component Map

```
┌─────────────────────────────────────────────────────────────────┐
│  Data Sources                                                   │
│  MIMIC-IV CSV (patients / admissions / diagnoses / icd_ref)     │
│  FHIR R4 JSON (Bundle or single Patient resource)               │
└───────────────────────┬─────────────────────────────────────────┘
                        │
        ┌───────────────▼───────────────┐
        │  ETL Layer (Python / PySpark)  │
        │  etl/extract.py               │  pandas, boto3
        │  etl/transform.py             │  gender norm, age_band, los_days
        │  etl/validate.py              │  Pydantic v2, NaN/NaT handling
        │  etl/load.py                  │  SQLAlchemy bulk insert
        └───────────────┬───────────────┘
                        │
        ┌───────────────▼───────────────┐
        │  PostgreSQL — Medallion DB    │
        │  raw.*        (source copy)   │
        │  raw.icd_reference (109k ICD) │
        │  clean.*      (standardised)  │
        │  research.*   (de-identified) │
        │  public.audit_logs            │
        └───────┬───────────────────────┘
                │
        ┌───────▼───────┐
        │  DBT          │  SQL transforms, JOIN icd_reference,
        │  5 models     │  ROW_NUMBER() de-id, readmission_30d
        │  22 tests     │  window function, lineage graph
        └───────┬───────┘
                │
        ┌───────▼────────────────────────────┐
        │  FastAPI  (api/)                   │
        │  JWT auth · RBAC · audit logging   │
        │  /pipeline · /data · /export       │
        │  /audit · /auth · /health          │
        └───────┬────────────────────────────┘
                │
        ┌───────▼────────────────┐    ┌──────────────────┐
        │  Next.js Frontend      │    │  AWS DynamoDB     │
        │  Dashboard · Pipeline  │    │  FHIR JSON docs   │
        │  Data · Export · Audit │    │  (separate path)  │
        └────────────────────────┘    └──────────────────┘
```

---

## Key Design Decisions

### Why Medallion Architecture?

Raw, clean, and research schemas are kept physically separate:

- `raw.*` is append-only and immutable — always replayable from source
- `clean.*` is owned by the Python ETL and DBT together; retains all rows but adds quality flags
- `research.*` is exclusively de-identified; subject_id never appears here

This separation means a researcher with `data_read_research` permission literally cannot query a table that contains subject_id — the data doesn't exist there.

### Why DBT on top of Python ETL?

The Python ETL handles the operationally tricky parts: NaN/NaT coercion, Pydantic validation, pandas datetime parsing, and the ICD description lookup from 109k rows. DBT handles the SQL-layer transformations that benefit from lineage tracking and automated testing (not_null, unique, custom assertions). The two layers complement each other and the output is consistent: both write to the same PostgreSQL schemas.

### ICD Reference Table (`raw.icd_reference`)

The original design used a 20-entry hardcoded dict for ICD descriptions, covering 20% of diagnoses. Loading `d_icd_diagnoses.csv` (MIMIC-IV supplied, 109,775 rows) into `raw.icd_reference` and joining in DBT's `clean_diagnoses.sql` brings coverage to 100%. The table is treated as a read-only reference (never modified by ETL runs).

### Why a unique constraint on `raw.diagnoses`?

`raw.diagnoses` uses a serial `id` PK but the natural business key is `(subject_id, hadm_id, seq_num, icd_code, icd_version)`. Without a unique constraint on this tuple, repeated pipeline runs insert duplicate rows (confirmed: 4 runs → 18,024 rows instead of 4,506). The `UNIQUE` constraint on the natural key, combined with `ON CONFLICT ON CONSTRAINT ... DO NOTHING`, makes the load idempotent.

### Why SHA-256 for anonymisation rather than a surrogate mapping?

For a demo platform, SHA-256 (truncated to 16 hex chars) is deterministic and reversible-with-key — meaning the same subject_id always produces the same anonymised_id without maintaining a lookup table. In production, a keyed HMAC or a cryptographic surrogate table with key rotation would be preferred.

### Why FastAPI over Django/Flask?

FastAPI generates OpenAPI/Swagger docs automatically (critical for a governance-conscious platform where API contracts need to be transparent), has native async support for future scale, and Pydantic v2 is the same validation library used in the ETL layer — shared models reduce duplication.

---

## Data Flow: One Pipeline Run

```
1. POST /pipeline/run (admin token)
   ↓
2. extract_patients_csv / extract_admissions_csv / extract_diagnoses_csv
   → 100 patients, 275 admissions, 4,506 diagnoses

3. transform_patients / transform_admissions / transform_diagnoses
   → gender normalised, age_band assigned, los_days calculated
   → icd_description looked up from d_icd_diagnoses.csv (100% coverage)

4. validate_patients / validate_admissions / validate_diagnoses
   → Pydantic v2 models enforce types + cross-field constraints
   → NaN/NaT → None coercion applied before validation

5. load_*_raw + load_*_clean → PostgreSQL
   → ON CONFLICT DO NOTHING (idempotent)
   → 100 + 275 + 4,506 rows written

6. (Separately) dbt run --select research
   → research.cohort: ROW_NUMBER() replaces subject_id
   → research.outcomes: readmission_30d via 30-day window

7. POST /export/request (researcher token)
   → deidentify_cohort(research.cohort records)
   → SHA-256 anonymised_id, k-anonymity suppression
   → 508-record CSV written to data/exports/

8. All steps logged to public.audit_logs
```

---

## Infrastructure Layout (AWS)

```
Internet
    │
    ▼
Route 53 (DNS)
    │
    ├── *.yourdomain.com → CloudFront / Amplify (Next.js frontend)
    │
    └── api.yourdomain.com → EC2 t3.micro
                              ├── nginx (port 80 → :8000)
                              └── uvicorn (FastAPI, systemd service)
                                        │
                              ┌─────────▼──────────────┐
                              │  RDS t3.micro           │
                              │  PostgreSQL 15          │
                              │  raw / clean / research  │
                              └────────────────────────┘
                                        │
                              S3: clinical-etl-raw
                              (raw CSV files, export staging)

DynamoDB (ap-southeast-2): clinical_etl_fhir
(FHIR JSON documents, separate access path)
```

---

*See [data_lineage.md](data_lineage.md) for DBT model lineage details.*  
*See [rbac_policy.md](rbac_policy.md) for full permission definitions.*  
*See [api_reference.md](api_reference.md) for endpoint contracts.*
