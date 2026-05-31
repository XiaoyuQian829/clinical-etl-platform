# ClinicalETL — Clinical Data Governance & Research Dataset Platform

> A production-grade ETL pipeline for clinical data ingestion, transformation, governance, and de-identified research export.  
> Built with Databricks · DBT · PostgreSQL · FastAPI · Next.js · AWS

---

## One-Line Pitch

From raw electronic medical records to auditable, de-identified research datasets — with full governance, RBAC, and data lineage.

---

## Pipeline Overview

```
Raw EMR Input (CSV / FHIR JSON)
        ↓
   [ AWS S3 ]
   Raw file storage
        ↓
   [ Databricks ]               [ AWS DynamoDB ]
   PySpark ETL notebooks    ←→  FHIR R4 JSON document store
   (or Python ETL locally)
        ↓
   [ PostgreSQL — Medallion Architecture ]
   raw.* → clean.* → research.*
   + raw.icd_reference (109,775 ICD-9/10 codes)
        ↓
   [ DBT ]
   SQL transforms · data lineage · 22 automated tests
        ↓
   [ FastAPI ]
   RBAC API + JWT auth + audit log
        ↓
   [ Next.js ]                  [ PowerBI ]
   Dashboard: pipeline / quality / cohort   Research analytics
        ↓
   De-identified Dataset Export (.csv)
```

---

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────┐
│                        AWS Cloud                          │
│                                                          │
│  ┌──────────┐    ┌─────────────┐    ┌──────────────┐    │
│  │  S3      │───▶│ Databricks  │───▶│ RDS           │    │
│  │ Raw Data │    │ (ETL jobs)  │    │ PostgreSQL 15 │    │
│  └──────────┘    └─────────────┘    └──────┬───────┘    │
│                         │                  │             │
│                  ┌──────▼──────┐    ┌──────▼──────┐     │
│                  │  DynamoDB   │    │    DBT       │     │
│                  │ FHIR docs   │    │   Models     │     │
│                  └─────────────┘    └──────┬───────┘     │
│                                           │              │
│  ┌──────────┐    ┌─────────────┐    ┌─────▼──────┐      │
│  │ Amplify  │◀───│  Next.js    │◀───│  FastAPI   │      │
│  │  (CDN)   │    │  Frontend   │    │  + EC2     │      │
│  └──────────┘    └─────────────┘    └────────────┘      │
└──────────────────────────────────────────────────────────┘
```

---

## File Tree

```
clinical-etl-platform/
│
├── README.md
├── .env.example
├── .gitignore
├── docker-compose.yml
├── requirements.txt
│
├── data/
│   ├── raw/                        # Raw MIMIC-IV demo input files
│   │   ├── patients.csv            # 100 patients
│   │   ├── admissions.csv          # 275 hospital admissions
│   │   ├── diagnoses_icd.csv       # 4,506 ICD-coded diagnoses
│   │   ├── d_icd_diagnoses.csv     # 109,775 ICD-9/10 reference codes
│   │   └── fhir_sample.json        # Sample FHIR R4 Bundle (3 patients)
│   └── exports/                    # De-identified output CSVs
│
├── databricks/
│   ├── notebooks/
│   │   ├── 01_extract.py           # Read CSV + FHIR JSON from S3 → Delta Lake
│   │   ├── 02_transform.py         # PySpark: standardise fields, ICD mapping
│   │   ├── 03_validate.py          # Quality checks, null counts, distributions
│   │   └── 04_load.py              # Write Delta → PostgreSQL via JDBC
│   └── config/
│       └── databricks_config.yml
│
├── dbt/
│   ├── dbt_project.yml
│   ├── profiles.yml
│   ├── macros/
│   │   └── generate_schema_name.sql  # Custom schema naming (clean/research exact)
│   ├── models/
│   │   ├── sources.yml              # Source definitions (raw.*)
│   │   ├── clean/                   # Cleaned, standardised models
│   │   │   ├── clean_patients.sql   # + age_band, data_quality_flag
│   │   │   ├── clean_admissions.sql # + los_days, quality flag
│   │   │   ├── clean_diagnoses.sql  # + icd_description (JOIN icd_reference)
│   │   │   └── schema.yml           # Column descriptions + not_null tests
│   │   └── research/                # Analytics-ready research layer
│   │       ├── research_cohort.sql  # ROW_NUMBER de-id, primary diagnosis
│   │       └── research_outcomes.sql # readmission_30d window function
│   └── tests/
│       ├── assert_no_duplicate_patients.sql
│       └── assert_valid_icd_codes.sql
│
├── etl/
│   ├── extract.py                  # CSV + FHIR JSON + S3 ingestion
│   ├── transform.py                # Gender norm, age_band, los_days, ICD lookup
│   ├── validate.py                 # Pydantic validation, duplicate detection
│   ├── load.py                     # SQLAlchemy bulk insert (NaN/NaT safe)
│   └── deidentify.py               # SHA-256 anon, k-anonymity (k=5)
│
├── models/
│   ├── patient.py                  # PatientRaw Pydantic model + validators
│   ├── admission.py                # AdmissionRaw + dischtime > admittime check
│   └── diagnosis.py                # DiagnosisRaw + icd_version in (9,10)
│
├── governance/
│   ├── rbac.py                     # Role enum, PERMISSIONS dict, check_permission
│   ├── audit.py                    # AuditEntry model, log_action, get_audit_logs
│   └── consent.py                  # Consent flag placeholder
│
├── api/
│   ├── main.py                     # FastAPI app, CORS, startup, /health, /auth/token
│   ├── routers/
│   │   ├── pipeline.py             # POST /pipeline/run, GET /pipeline/status/{id}
│   │   ├── data.py                 # GET /data/clean/patients, /data/research/cohort
│   │   ├── export.py               # POST /export/request, GET /export/download/{id}
│   │   └── audit.py                # GET /audit/logs
│   ├── middleware/
│   │   └── auth.py                 # JWT (python-jose), sha256_crypt, require_role dep
│   └── schemas/
│       └── response.py             # Standard {status, data, error} shape
│
├── frontend/                       # Next.js 14 App Router
│   ├── package.json
│   ├── next.config.js
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── postcss.config.js
│   ├── amplify.yml                 # AWS Amplify build spec
│   └── src/
│       ├── app/
│       │   ├── page.tsx            # Dashboard: stats, recharts quality bar
│       │   ├── pipeline/page.tsx   # Trigger + 5s polling + step progress
│       │   ├── data/page.tsx       # Tabbed browser (clean / research + filters)
│       │   ├── export/page.tsx     # Request + download de-identified CSV
│       │   ├── audit/page.tsx      # Paginated audit log + filter
│       │   └── login/page.tsx      # Login form → JWT → localStorage
│       ├── components/
│       │   └── RBACGuard.tsx       # Role hierarchy check + AccessDenied render
│       ├── lib/
│       │   └── api.ts              # Typed API client (axios + JWT interceptor)
│       └── middleware.ts           # Next.js route middleware
│
├── powerbi/
│   └── clinical_dashboard.pbix     # PowerBI report (research layer)
│
├── dynamodb/
│   ├── fhir_ingest.py              # ingest_fhir_document, create_table_if_not_exists
│   ├── fhir_query.py               # get_fhir_by_subject_id, list_all_subjects
│   └── schema/
│       └── fhir_patient.json       # FHIR R4 Patient resource schema reference
│
├── .github/
│   └── workflows/
│       ├── dbt_test.yml            # PR: postgres container + dbt run + dbt test
│       └── deploy.yml              # Merge to main: EC2 SSH + Amplify deploy
│
├── infra/
│   ├── aws/
│   │   ├── ec2_setup.sh            # Amazon Linux 2023 + uvicorn systemd + nginx
│   │   ├── rds_init.sql            # Full PostgreSQL schema (raw/clean/research)
│   │   └── s3_bucket_policy.json   # EC2 instance role read/write policy
│   └── terraform/                  # Optional IaC skeleton
│
└── docs/
    ├── ClinicalETL_SystemDesign.md  # This file
    ├── ClinicalETL_DevChecklist.md  # Step-by-step build + verification log
    ├── architecture.md              # Technical decisions + component design
    ├── data_lineage.md              # End-to-end lineage from raw to export
    ├── rbac_policy.md               # Role definitions + permission matrix
    └── api_reference.md             # Full API endpoint reference
```

---

## Technology Stack

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Data Source | MIMIC-IV Demo | v2.2 | Real clinical dataset (100 patients, 275 admissions, 4,506 diagnoses) |
| Storage | AWS S3 | — | Raw file ingestion, export staging |
| ETL Engine | Databricks (PySpark) | Community | 4-step notebook pipeline (extract → transform → validate → load) |
| ETL (local) | Python + pandas | 3.11+ | Same pipeline runnable without Databricks |
| ICD Reference | d_icd_diagnoses.csv | MIMIC-IV | 109,775 ICD-9/10 codes loaded to raw.icd_reference |
| Transform | DBT | 1.8 / 1.10 | 5 SQL models, 22 automated tests, lineage graph |
| Relational DB | PostgreSQL | 15 | Four-layer medallion warehouse (raw/clean/research + icd_reference) |
| NoSQL DB | AWS DynamoDB | — | Raw FHIR R4 JSON document store |
| Validation | Pydantic | v2 | Schema enforcement, cross-field validators, NaN/NaT handling |
| API | FastAPI | 0.111 | RBAC-protected endpoints, Swagger UI |
| Auth | JWT (python-jose) | — | Token-based, 60-min expiry, sha256_crypt password hash |
| Governance | Custom RBAC + Audit Log | — | 3 roles, 9 actions, JSONB detail field |
| De-identification | SHA-256 + k-anonymity | k=5 | GDPR/HIPAA-aligned PII removal |
| Frontend | Next.js + TypeScript | 14 | App Router, Tailwind CSS, recharts, @tanstack/react-query |
| Analytics | PowerBI | — | Research-layer dashboard (.pbix) |
| Cloud | AWS (EC2, RDS, S3, Amplify) | — | Full production deployment |
| CI/CD | GitHub Actions | — | DBT tests on PR + AWS deploy on merge |

---

## Database: Medallion Architecture

```
raw.*        ← Exact copy of source data, no transforms applied
clean.*      ← Standardised, validated, quality-flagged
research.*   ← Analytics-ready, de-identified, cohort-ready
```

### Full Table Inventory

| Schema | Table | Rows | Key Fields | Notes |
|---|---|---|---|---|
| raw | patients | 100 | subject_id (PK) | gender, anchor_age, anchor_year, dod |
| raw | admissions | 275 | hadm_id (PK) | admittime, dischtime, admission_type, race |
| raw | diagnoses | 4,506 | id (serial) + UNIQUE(subject_id,hadm_id,seq_num,icd_code,icd_version) | icd_code, icd_version (9 or 10) |
| raw | icd_reference | 109,775 | PK(icd_code, icd_version) | long_title — full ICD-9/10 descriptions from d_icd_diagnoses.csv |
| clean | patients | 100 | subject_id (PK) | + age_band (PAEDIATRIC/YOUNG_ADULT/ADULT/ELDERLY), data_quality_flag |
| clean | admissions | 275 | hadm_id (PK) | + los_days (float), data_quality_flag |
| clean | diagnoses | 4,506 | id (serial) + UNIQUE natural key | + icd_description (JOIN icd_reference), is_valid_code |
| research | cohort | 275 | cohort_id (ROW_NUMBER) | age_band, gender, admission_type, los_days, primary_diagnosis_code/desc, is_deidentified=true |
| research | outcomes | 275 | cohort_id (FK) | readmission_30d (bool), icu_admission (bool) |
| public | audit_logs | grows | id (serial) | user_id, role, action, resource, ip_address, outcome, detail (JSONB) |

---

## Governance Model

### RBAC Roles

| Role | Actions Permitted |
|---|---|
| admin | user_management, audit_read, pipeline_run, pipeline_status, data_read_raw, data_read_clean, data_read_research, export_request, export_download |
| researcher | pipeline_status, data_read_clean, data_read_research, export_request, export_download |
| viewer | data_read_research |

### Audit Log Schema

```json
{
  "id": 42,
  "timestamp": "2026-05-31T04:55:33Z",
  "user_id": "researcher_01",
  "role": "researcher",
  "action": "export_requested",
  "resource": "research.cohort",
  "ip_address": "127.0.0.1",
  "outcome": "approved",
  "detail": {"export_id": "0dfe4bad", "record_count": 508}
}
```

---

## De-identification Pipeline

```
research.cohort (queried via /export/request)
    ↓
1. remove_direct_identifiers()
   — subject_id → SHA-256 truncated to 16 chars (anonymised_id)
   — removes: name, dob, dod, address, MRN fields
2. generalise_quasi_identifiers()
   — postcode → region (QLD/NSW/VIC hardcoded dict)
   — los_days → rounded to nearest 0.5
3. check_k_anonymity(k=5)
   — groups by (age_band, gender, admission_type)
   — suppresses groups with < 5 records
    ↓
De-identified CSV (no subject_id in output)
```

Note: `research.cohort` is already de-identified by construction (DBT uses `ROW_NUMBER()` as cohort_id, never exposes subject_id). The deidentify pipeline applies a second pass for belt-and-suspenders PII removal before export.

---

## API Endpoints (Implemented)

| Method | Endpoint | Role Required | Description |
|---|---|---|---|
| POST | /auth/token | — | Login (OAuth2 form), returns JWT + role |
| GET | /health | — | Health check, returns timestamp |
| POST | /pipeline/run | admin | Trigger full ETL: extract→transform→validate→load |
| GET | /pipeline/status/{run_id} | admin, researcher | Step-level status + record counts |
| GET | /data/clean/patients | admin, researcher | Paginated clean.patients (limit/offset) |
| GET | /data/research/cohort | all roles | Paginated + filterable (age_band, gender, admission_type) |
| POST | /export/request | researcher | Generate de-identified CSV, returns export_id |
| GET | /export/download/{id} | researcher | Download CSV as FileResponse |
| GET | /audit/logs | admin | Audit trail (filterable by user_id, action) |

---

## Interview Demo Script

> "I built a clinical ETL platform using MIMIC-IV real clinical data.  
> The Python ETL pipeline extracts from MIMIC-IV CSV and FHIR JSON, validates through  
> Pydantic models, and loads into a three-layer PostgreSQL medallion warehouse.  
> DBT manages the SQL transforms with full data lineage and 22 automated tests.  
> A governed FastAPI exposes RBAC-protected endpoints with JWT auth and a complete  
> audit trail. Researchers can browse the clean and research layers, request  
> de-identified cohort exports, and every action is logged. The Next.js dashboard  
> wraps all of this with a professional UI. Everything is designed to deploy on AWS  
> with CI/CD via GitHub Actions."

**Then open the URL. Let them click around.**

---

## Deployment URLs (fill after AWS deploy)

- Frontend: `https://clinical-etl.yourdomain.com`
- API docs: `https://api.clinical-etl.yourdomain.com/docs`
- DBT docs: `https://docs.clinical-etl.yourdomain.com`

---

*Built for UQ Queensland Digital Health Centre Data Engineer application (R-63033) — demonstrating end-to-end clinical data engineering capability.*
