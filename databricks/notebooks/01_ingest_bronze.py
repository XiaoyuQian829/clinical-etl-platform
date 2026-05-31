# Databricks notebook source
# MAGIC %md
# MAGIC # 01 · Ingest → Bronze Layer
# MAGIC
# MAGIC Reads raw MIMIC-IV CSV files from ADLS Gen2 / S3 and writes
# MAGIC them as-is to the Delta Lake **bronze** layer.
# MAGIC No transformations — exact source copy with metadata columns added.
# MAGIC
# MAGIC **Source files — hosp/**
# MAGIC - `patients.csv` (100 rows)
# MAGIC - `admissions.csv` (275 rows)
# MAGIC - `diagnoses_icd.csv` (4,506 rows)
# MAGIC - `d_icd_diagnoses.csv` — ICD-10 reference (109,775 rows)
# MAGIC - `d_icd_procedures.csv` — procedure reference (85,257 rows)
# MAGIC - `d_labitems.csv` / `d_hcpcs.csv` — lab & HCPCS reference
# MAGIC - `labevents.csv` (107,727 rows)
# MAGIC - `prescriptions.csv` (18,087 rows)
# MAGIC - `pharmacy.csv` / `emar.csv` / `emar_detail.csv`
# MAGIC - `procedures_icd.csv` / `drgcodes.csv` / `microbiologyevents.csv`
# MAGIC - `poe.csv` / `poe_detail.csv` / `omr.csv` / `services.csv` / `transfers.csv` / `hcpcsevents.csv`
# MAGIC
# MAGIC **Source files — icu/**
# MAGIC - `icustays.csv` (140 rows)
# MAGIC - `chartevents.csv` (668,862 rows) — vitals
# MAGIC - `d_items.csv` — ICU item dictionary (4,014 rows)
# MAGIC - `inputevents.csv` (20,404) / `outputevents.csv` (9,362)
# MAGIC - `procedureevents.csv` (1,468) / `datetimeevents.csv` (15,280) / `ingredientevents.csv` (25,728)

# COMMAND ----------

# MAGIC %md ## 0 · Configuration
# MAGIC Replace `STORAGE_ACCOUNT`, `CONTAINER`, `RAW_PATH` with your environment values.

# COMMAND ----------

# AWS S3 config — matches databricks/config/databricks_config.yml
S3_BUCKET   = "clinical-etl-raw"          # your bucket name
S3_PREFIX   = "mimic-iv-demo"
RAW_PATH    = f"s3a://{S3_BUCKET}/{S3_PREFIX}/raw"
BRONZE_PATH = f"s3a://{S3_BUCKET}/{S3_PREFIX}/bronze"

# For local demo using DBFS mount (after running config/databricks_config.yml mounts):
# RAW_PATH    = "/mnt/clinical_etl/raw"
# BRONZE_PATH = "/mnt/clinical_etl/bronze"

# COMMAND ----------

# MAGIC %md ## 1 · Ingest patients

# COMMAND ----------

from pyspark.sql import functions as F
from pyspark.sql.types import StructType, StructField, IntegerType, StringType, TimestampType
from datetime import datetime

INGEST_TIMESTAMP = F.lit(datetime.utcnow().isoformat()).cast("timestamp")

# COMMAND ----------

patients_df = (
    spark.read
    .option("header", "true")
    .option("inferSchema", "true")
    .csv(f"{RAW_PATH}/patients.csv")
    .withColumn("_ingested_at", INGEST_TIMESTAMP)
    .withColumn("_source_file", F.lit("patients.csv"))
)

print(f"patients: {patients_df.count():,} rows")
patients_df.printSchema()

# COMMAND ----------

(
    patients_df.write
    .format("delta")
    .mode("overwrite")
    .option("overwriteSchema", "true")
    .save(f"{BRONZE_PATH}/patients")
)
print("✓ bronze.patients written")

# COMMAND ----------

# MAGIC %md ## 2 · Ingest admissions

# COMMAND ----------

admissions_df = (
    spark.read
    .option("header", "true")
    .option("inferSchema", "true")
    .csv(f"{RAW_PATH}/admissions.csv")
    .withColumn("_ingested_at", INGEST_TIMESTAMP)
    .withColumn("_source_file", F.lit("admissions.csv"))
)

print(f"admissions: {admissions_df.count():,} rows")

(
    admissions_df.write
    .format("delta")
    .mode("overwrite")
    .option("overwriteSchema", "true")
    .save(f"{BRONZE_PATH}/admissions")
)
print("✓ bronze.admissions written")

# COMMAND ----------

# MAGIC %md ## 3 · Ingest diagnoses

# COMMAND ----------

diagnoses_df = (
    spark.read
    .option("header", "true")
    .option("inferSchema", "true")
    .csv(f"{RAW_PATH}/diagnoses_icd.csv")
    .withColumn("_ingested_at", INGEST_TIMESTAMP)
    .withColumn("_source_file", F.lit("diagnoses_icd.csv"))
)

print(f"diagnoses: {diagnoses_df.count():,} rows")

(
    diagnoses_df.write
    .format("delta")
    .mode("overwrite")
    .option("overwriteSchema", "true")
    .save(f"{BRONZE_PATH}/diagnoses")
)
print("✓ bronze.diagnoses written")

# COMMAND ----------

# MAGIC %md ## 4 · Ingest ICD reference (109,775 codes)

# COMMAND ----------

icd_ref_df = (
    spark.read
    .option("header", "true")
    .option("inferSchema", "true")
    .csv(f"{RAW_PATH}/d_icd_diagnoses.csv")
    .withColumn("_ingested_at", INGEST_TIMESTAMP)
    .withColumn("_source_file", F.lit("d_icd_diagnoses.csv"))
)

print(f"icd_reference: {icd_ref_df.count():,} rows")

(
    icd_ref_df.write
    .format("delta")
    .mode("overwrite")
    .option("overwriteSchema", "true")
    .save(f"{BRONZE_PATH}/icd_reference")
)
print("✓ bronze.icd_reference written")

# COMMAND ----------

# MAGIC %md ## 5 · Summary

# COMMAND ----------

summary = {
    "bronze.patients":      spark.read.format("delta").load(f"{BRONZE_PATH}/patients").count(),
    "bronze.admissions":    spark.read.format("delta").load(f"{BRONZE_PATH}/admissions").count(),
    "bronze.diagnoses":     spark.read.format("delta").load(f"{BRONZE_PATH}/diagnoses").count(),
    "bronze.icd_reference": spark.read.format("delta").load(f"{BRONZE_PATH}/icd_reference").count(),
}

for table, count in summary.items():
    print(f"  {table}: {count:,} rows")

print("\nBronze ingestion complete.")
