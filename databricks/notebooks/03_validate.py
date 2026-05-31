# Databricks notebook: 03_validate.py
# Data quality checks on transformed Delta tables.

# COMMAND ----------
from pyspark.sql import functions as F

DELTA_CLEAN = "/mnt/clinical_etl/clean"


def quality_report(df, entity: str):
    print(f"\n=== {entity} Quality Report ===")
    print(f"Total records: {df.count()}")
    print("Null counts per column:")
    null_counts = df.select([F.count(F.when(F.col(c).isNull(), c)).alias(c) for c in df.columns])
    null_counts.display()


# COMMAND ----------
patients_df = spark.read.format("delta").load(f"{DELTA_CLEAN}/patients")
quality_report(patients_df, "Patients")
print("Gender distribution:")
patients_df.groupBy("gender").count().display()
print("Age band distribution:")
patients_df.groupBy("age_band").count().display()

# COMMAND ----------
admissions_df = spark.read.format("delta").load(f"{DELTA_CLEAN}/admissions")
quality_report(admissions_df, "Admissions")
print("Admission type distribution:")
admissions_df.groupBy("admission_type").count().display()
print("LOS days statistics:")
admissions_df.select(
    F.min("los_days").alias("min_los"),
    F.max("los_days").alias("max_los"),
    F.avg("los_days").alias("avg_los"),
    F.percentile_approx("los_days", 0.5).alias("median_los"),
).display()

# COMMAND ----------
diagnoses_df = spark.read.format("delta").load(f"{DELTA_CLEAN}/diagnoses")
quality_report(diagnoses_df, "Diagnoses")
print("ICD version split:")
diagnoses_df.groupBy("icd_version").count().display()
print("Valid code rate:")
diagnoses_df.groupBy("is_valid_code").count().display()
