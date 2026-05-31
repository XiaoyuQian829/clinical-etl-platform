# ClinicalETL — Clinical Data Governance & Research Dataset Platform

> Production-grade ETL pipeline for clinical data ingestion, transformation, governance, and de-identified research export.  
> Built with **Databricks · DBT · PostgreSQL · FastAPI · Next.js · AWS**

**Live Demo:** http://15.134.175.175:3000  
**API Docs:** http://15.134.175.175:8000/docs  
**Region:** AWS ap-southeast-2 (Sydney)

---

## Architecture

```
Raw EMR Input (CSV / FHIR JSON)
        ↓
   [ AWS S3 ]
   Raw file storage
        ↓
   [ Databricks ]               [ AWS DynamoDB ]
   PySpark ETL notebooks    ←→  FHIR JSON document store
        ↓
   [ PostgreSQL — Medallion Architecture ]
   raw.* → clean.* → research.*
        ↓
   [ DBT ]
   SQL transforms · data lineage · automated tests
        ↓
   [ FastAPI ]
   RBAC API · JWT auth · audit logging
        ↓
   [ Next.js ]                  [ PowerBI ]
   Dashboard · pipeline · export   Research analytics
        ↓
   De-identified CSV Export

AWS: EC2 (API) · RDS (PostgreSQL) · S3 (raw files) · Amplify (frontend)
CI/CD: GitHub Actions — dbt test on PR, deploy on merge to main
```

---

## Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Data Source | MIMIC-IV Demo | Real clinical dataset (100 patients, 275 admissions, 4,506 diagnoses) |
| Storage | AWS S3 | Raw file ingestion |
| ETL Engine | Databricks (PySpark) | Extract · Transform · Validate · Load notebooks |
| ETL (local) | Python (pandas, Pydantic) | Same pipeline runnable without Databricks |
| Transform | DBT 1.8 | SQL-layer modelling, lineage graph, 20 automated tests |
| Relational DB | PostgreSQL 15 / AWS RDS | Three-layer medallion warehouse |
| NoSQL DB | AWS DynamoDB | Raw FHIR R4 JSON document store |
| Validation | Pydantic v2 | Schema enforcement, cross-field validators |
| API | FastAPI | RBAC-protected endpoints, Swagger UI |
| Auth | JWT (python-jose) | Token-based authentication |
| Governance | Custom RBAC + Audit Log | Field-level access, full audit trail with JSONB detail |
| De-identification | SHA-256 + k-anonymity | GDPR/HIPAA-aligned PII removal |
| Frontend | Next.js 14 (TypeScript) | Dashboard, pipeline control, cohort browser, export UI |
| Analytics | PowerBI | Research-layer dashboard |
| Cloud | AWS (EC2, RDS, S3, Amplify) | Full production deployment |
| CI/CD | GitHub Actions | Automated DBT tests on PR + AWS deploy on merge |

---

## Database: Medallion Architecture

```
raw.*      ← Exact copy of source data, no transforms applied
clean.*    ← Standardised fields, validated, quality-flagged
research.* ← Analytics-ready, de-identified, cohort-ready
```

**29 raw tables** across hosp and ICU modules — ~1.3M rows total.

| Schema | Key tables | Rows | Notes |
|---|---|---|---|
| raw | patients, admissions, diagnoses | 100 / 275 / 4,506 | Core clinical tables |
| raw | chart_events | 589,080 | ICU vitals (heart rate, BP, SpO2…) |
| raw | lab_events | 107,727 | Lab results with reference ranges |
| raw | icd_reference | 109,775 | Full ICD-9/10 code descriptions |
| raw | prescriptions, pharmacy, emar | 18K / 15K / 36K | Medication orders + administration |
| raw | input_events, output_events | 20K / 9K | ICU fluid balance |
| raw | poe, poe_detail | 45K / 3.8K | Provider order entry |
| raw | icu_stays | 140 | ICU unit + length of stay |
| raw | procedures_icd, drg_codes | 722 / 454 | ICD procedures + DRG billing |
| raw | microbiology_events | 2,899 | Culture results + sensitivities |
| clean | patients, admissions, diagnoses | 100 / 275 / 4,506 | Validated, standardised, quality-flagged |
| research | cohort, outcomes | 275 / 275 | De-identified, k=5 anonymised |
| public | audit_logs | — | Every action logged with JSONB detail |

---

## RBAC Roles

| Role | Permissions |
|---|---|
| `admin` | All actions: pipeline run, audit read, all data layers, export |
| `researcher` | Pipeline status, clean + research read, export request/download |
| `viewer` | Research layer read-only, no export |

**Demo credentials:**

| Username | Password | Role |
|---|---|---|
| `admin_user` | `admin123` | admin |
| `researcher_user` | `researcher123` | researcher |
| `viewer_user` | `viewer123` | viewer |

---

## API Endpoints

| Method | Endpoint | Role | Description |
|---|---|---|---|
| POST | `/auth/token` | — | Login, returns JWT |
| GET | `/health` | — | Health check |
| POST | `/pipeline/run` | admin | Trigger full ETL pipeline |
| GET | `/pipeline/status/{run_id}` | admin, researcher | Run status + step progress |
| GET | `/data/clean/patients` | admin, researcher | Paginated clean layer |
| GET | `/data/research/cohort` | all | Paginated + filterable research layer |
| POST | `/export/request` | researcher | Generate de-identified CSV |
| GET | `/export/download/{id}` | researcher | Download CSV |
| GET | `/audit/logs` | admin | Audit trail (filterable) |

---

## De-identification Pipeline

```
research.cohort
    ↓
1. remove_direct_identifiers()
   — subject_id → SHA-256 anonymised_id
   — remove: name, DOB, address, MRN, dod
2. generalise_quasi_identifiers()
   — postcode → region (QLD/NSW/VIC)
   — los_days → rounded to nearest 0.5
3. check_k_anonymity(k=5)
   — suppress groups (age_band, gender, admission_type) with < 5 records
    ↓
De-identified CSV Export
```

---

## Local Setup

### Prerequisites
- Python 3.11+, PostgreSQL 15+, Node.js 20+

```bash
# 1. Clone
git clone https://github.com/XiaoyuQian829/clinical-etl-platform.git
cd clinical-etl-platform

# 2. Environment
cp .env.example .env
# Fill in POSTGRES_PASSWORD and JWT_SECRET_KEY

# 3. PostgreSQL (Docker)
docker-compose up -d
# OR: start local postgres and run:
psql -U admin -d clinical_etl -f infra/aws/rds_init.sql

# 4. Python deps
pip install -r requirements.txt

# 5. Run ETL (loads raw → clean)
python3 -c "
from etl.extract import *; from etl.transform import *
from etl.validate import *; from etl.load import *
engine = get_engine()
pv,_ = validate_patients(transform_patients(extract_patients_csv('data/raw/patients.csv')))
av,_ = validate_admissions(transform_admissions(extract_admissions_csv('data/raw/admissions.csv')))
dv,_ = validate_diagnoses(transform_diagnoses(extract_diagnoses_csv('data/raw/diagnoses_icd.csv')))
load_patients_raw(pv,engine); load_admissions_raw(av,engine); load_diagnoses_raw(dv,engine)
load_patients_clean(pv,engine); load_admissions_clean(av,engine); load_diagnoses_clean(dv,engine)
print('ETL complete')
"

# 6. DBT (populates research layer)
dbt run --profiles-dir dbt --project-dir dbt
dbt test --profiles-dir dbt --project-dir dbt

# 7. Start API
uvicorn api.main:app --reload
# → http://localhost:8000/docs

# 8. Start frontend
cd frontend && npm install && npm run dev
# → http://localhost:3000
```

---

## CI/CD Pipeline

```
PR to main
  └── dbt_test.yml
      ├── Spin up postgres:15 container
      ├── Run rds_init.sql
      ├── Run Python ETL to populate raw/clean
      ├── dbt run
      ├── dbt test (20 tests)
      └── Post results as PR comment

Merge to main
  └── deploy.yml
      ├── Configure AWS credentials
      ├── SSH to EC2 → git pull + restart uvicorn systemd service
      └── aws amplify start-job → rebuild Next.js frontend
```

---

## Data Lineage (DBT)

```
raw.patients ──┐
               ├──► clean.patients ──┐
raw.admissions─┤                     ├──► research.cohort ──► research.outcomes
               ├──► clean.admissions─┘
raw.diagnoses──┘
               └──► clean.diagnoses──┘
```

Run `dbt docs serve` to explore the interactive lineage graph.

---

## Deployment (AWS)

```bash
# EC2 setup (run once on fresh instance)
chmod +x infra/aws/ec2_setup.sh && ./infra/aws/ec2_setup.sh

# RDS schema
psql -h RDS_ENDPOINT -U admin -d clinical_etl -f infra/aws/rds_init.sql

# S3 bucket policy
aws s3api put-bucket-policy --bucket clinical-etl-raw \
  --policy file://infra/aws/s3_bucket_policy.json

# Amplify — connect GitHub repo, set NEXT_PUBLIC_API_URL=http://EC2_IP
```

---

## Data Attribution

This project uses the **MIMIC-IV Clinical Database Demo** (v2.2) from PhysioNet.  
Data is de-identified by the original collectors and used under the [PhysioNet Credentialed Health Data License 1.5.0](https://physionet.org/content/mimiciv/view-license/2.2/).

> Johnson, A., Bulgarelli, L., Pollard, T., Horng, S., Celi, L. A., & Mark, R. (2023). MIMIC-IV (version 2.2). PhysioNet.

---

*Built for UQ Data Engineer application (R-63033).*  
*Demonstrates end-to-end clinical data engineering: ingestion → governance → de-identified research export.*
