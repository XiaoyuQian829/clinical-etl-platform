# Databricks notebook: 01_extract.py
# Reads CSV and FHIR JSON from S3 into Delta Lake tables.
# Run on Databricks Community Edition.

# COMMAND ----------
# dbutils.widgets.text("s3_bucket", "clinical-etl-raw")
# dbutils.widgets.text("s3_prefix", "mimic-iv-demo/")

# COMMAND ----------
import json
from pyspark.sql import functions as F

S3_BUCKET = "clinical-etl-raw"   # dbutils.widgets.get("s3_bucket")
S3_PREFIX = "mimic-iv-demo/"      # dbutils.widgets.get("s3_prefix")
DELTA_BASE = "/mnt/clinical_etl/raw"

# COMMAND ----------
# -- Patients --
patients_df = spark.read.csv(
    f"s3a://{S3_BUCKET}/{S3_PREFIX}patients.csv",
    header=True, inferSchema=True
)
print(f"Patients: {patients_df.count()} rows")
patients_df.display()
patients_df.write.format("delta").mode("overwrite").save(f"{DELTA_BASE}/patients")

# COMMAND ----------
# -- Admissions --
admissions_df = spark.read.csv(
    f"s3a://{S3_BUCKET}/{S3_PREFIX}admissions.csv",
    header=True, inferSchema=True
)
print(f"Admissions: {admissions_df.count()} rows")
admissions_df.display()
admissions_df.write.format("delta").mode("overwrite").save(f"{DELTA_BASE}/admissions")

# COMMAND ----------
# -- Diagnoses --
diagnoses_df = spark.read.csv(
    f"s3a://{S3_BUCKET}/{S3_PREFIX}diagnoses_icd.csv",
    header=True, inferSchema=True
)
print(f"Diagnoses: {diagnoses_df.count()} rows")
diagnoses_df.display()
diagnoses_df.write.format("delta").mode("overwrite").save(f"{DELTA_BASE}/diagnoses")

# COMMAND ----------
# -- FHIR JSON (sample) --
fhir_df = spark.read.json(f"s3a://{S3_BUCKET}/{S3_PREFIX}fhir_sample.json", multiLine=True)
fhir_patients = fhir_df.filter(F.col("resourceType") == "Patient")
print(f"FHIR Patient resources: {fhir_patients.count()}")
fhir_patients.display()
