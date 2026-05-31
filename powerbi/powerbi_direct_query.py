"""
PowerBI Direct Query helper — prints the M-Query connection strings
that PowerBI Desktop needs to connect directly to PostgreSQL.

Paste the output into PowerBI: Home → Transform Data → Advanced Editor

Run:
    python powerbi/powerbi_direct_query.py
"""

import os

PG_HOST     = os.getenv("POSTGRES_HOST",     "localhost")
PG_PORT     = os.getenv("POSTGRES_PORT",     "5432")
PG_DB       = os.getenv("POSTGRES_DB",       "clinicaldb")
PG_USER     = os.getenv("POSTGRES_USER",     "clinicaladmin")

TABLES = [
    ("research", "cohort",           "De-identified cohort — safe for analysis"),
    ("clean",    "patients",         "Validated patients (admin/researcher only)"),
    ("clean",    "admissions",       "Validated admissions with LOS"),
    ("clean",    "diagnoses",        "Diagnoses with ICD descriptions"),
]

def m_query(schema: str, table: str) -> str:
    return f"""let
    Source = PostgreSQL.Database("{PG_HOST}:{PG_PORT}", "{PG_DB}",
        [Query = "SELECT * FROM {schema}.{table}"]),
    Result = Source
in
    Result"""

def main() -> None:
    print("=" * 60)
    print("PowerBI M-Query connection strings")
    print(f"Host: {PG_HOST}:{PG_PORT}  DB: {PG_DB}  User: {PG_USER}")
    print("=" * 60)
    for schema, table, note in TABLES:
        print(f"\n── {schema}.{table} ──")
        print(f"   {note}")
        print()
        print(m_query(schema, table))

    print("\n" + "=" * 60)
    print("REST API endpoints (use Web connector in PowerBI):")
    API_BASE = os.getenv("API_BASE_URL", "http://localhost:8000")
    print(f"  Research cohort:  {API_BASE}/research/cohort?limit=10000")
    print(f"  Clean patients:   {API_BASE}/clean/patients?limit=10000")
    print(f"  Audit log:        {API_BASE}/audit/logs?limit=10000")
    print("\nFor REST: PowerBI → Get Data → Web → paste URL above.")
    print("Set Authorization header: Bearer <token>")

if __name__ == "__main__":
    main()
