"""
Export research cohort from PostgreSQL → CSV files ready for PowerBI import.

Run from project root:
    python powerbi/export_for_powerbi.py

Outputs to powerbi/exports/:
    cohort_summary.csv       — de-identified cohort (one row per admission)
    diagnosis_frequency.csv  — top diagnoses by count
    los_by_admission_type.csv — average LOS per admission type
    quality_flags.csv        — data quality breakdown per layer
"""

from __future__ import annotations
import csv
import os
from pathlib import Path
from datetime import datetime

import psycopg2
import psycopg2.extras

# ---------------------------------------------------------------------------
# Connection — reads same env vars as the FastAPI app
# ---------------------------------------------------------------------------
DB_CONFIG = {
    "host":     os.getenv("POSTGRES_HOST",     "localhost"),
    "port":     int(os.getenv("POSTGRES_PORT", "5432")),
    "dbname":   os.getenv("POSTGRES_DB",       "clinicaldb"),
    "user":     os.getenv("POSTGRES_USER",     "clinicaladmin"),
    "password": os.getenv("POSTGRES_PASSWORD", "clinicalsecret"),
}

OUTPUT_DIR = Path(__file__).parent / "exports"
OUTPUT_DIR.mkdir(exist_ok=True)


def export_query(conn, filename: str, sql: str, params: tuple = ()) -> int:
    out_path = OUTPUT_DIR / filename
    with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
        cur.execute(sql, params)
        rows = cur.fetchall()
        if not rows:
            print(f"  [skip] {filename} — no rows returned")
            return 0
        with open(out_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=rows[0].keys())
            writer.writeheader()
            writer.writerows(rows)
    print(f"  ✓ {filename}: {len(rows):,} rows → {out_path}")
    return len(rows)


def main() -> None:
    print(f"Connecting to {DB_CONFIG['host']}:{DB_CONFIG['port']}/{DB_CONFIG['dbname']} …")
    conn = psycopg2.connect(**DB_CONFIG)

    print(f"\nExporting to {OUTPUT_DIR}/\n")

    # 1 · Full de-identified cohort
    export_query(conn, "cohort_summary.csv", """
        SELECT
            cohort_id,
            anonymised_id,
            age_band,
            gender,
            admission_type,
            ROUND(los_days::numeric, 1)  AS los_days,
            primary_diagnosis_code,
            primary_diagnosis_desc,
            is_deidentified
        FROM research.cohort
        ORDER BY cohort_id
    """)

    # 2 · Diagnosis frequency (top 50)
    export_query(conn, "diagnosis_frequency.csv", """
        SELECT
            primary_diagnosis_code  AS icd_code,
            primary_diagnosis_desc  AS description,
            COUNT(*)                AS admission_count,
            ROUND(AVG(los_days)::numeric, 1) AS avg_los_days
        FROM research.cohort
        WHERE primary_diagnosis_code IS NOT NULL
        GROUP BY primary_diagnosis_code, primary_diagnosis_desc
        ORDER BY admission_count DESC
        LIMIT 50
    """)

    # 3 · LOS by admission type
    export_query(conn, "los_by_admission_type.csv", """
        SELECT
            admission_type,
            COUNT(*)                           AS admissions,
            ROUND(AVG(los_days)::numeric, 2)   AS avg_los_days,
            ROUND(MIN(los_days)::numeric, 2)   AS min_los_days,
            ROUND(MAX(los_days)::numeric, 2)   AS max_los_days,
            ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY los_days)::numeric, 2) AS median_los_days
        FROM research.cohort
        WHERE los_days IS NOT NULL
        GROUP BY admission_type
        ORDER BY admissions DESC
    """)

    # 4 · Cohort by age band + gender
    export_query(conn, "cohort_demographics.csv", """
        SELECT
            age_band,
            gender,
            COUNT(*)                           AS count,
            ROUND(AVG(los_days)::numeric, 2)   AS avg_los_days
        FROM research.cohort
        GROUP BY age_band, gender
        ORDER BY age_band, gender
    """)

    # 5 · Data quality flags from clean layer
    export_query(conn, "quality_flags.csv", """
        SELECT 'clean.patients' AS layer,
               data_quality_flag,
               COUNT(*) AS record_count
        FROM clean.patients
        GROUP BY data_quality_flag
        UNION ALL
        SELECT 'clean.admissions',
               data_quality_flag,
               COUNT(*)
        FROM clean.admissions
        GROUP BY data_quality_flag
        ORDER BY layer, data_quality_flag
    """)

    # 6 · Monthly admissions trend
    export_query(conn, "admissions_trend.csv", """
        SELECT
            DATE_TRUNC('month', admittime)::date AS month,
            COUNT(*)                              AS admissions,
            ROUND(AVG(los_days)::numeric, 2)      AS avg_los_days
        FROM clean.admissions
        WHERE admittime IS NOT NULL
        GROUP BY DATE_TRUNC('month', admittime)
        ORDER BY month
    """)

    conn.close()
    print(f"\nAll exports complete — open PowerBI Desktop and import from {OUTPUT_DIR}/")
    print("Tip: use 'Get Data → Text/CSV' for each file.")


if __name__ == "__main__":
    main()
