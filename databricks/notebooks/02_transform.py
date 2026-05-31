# Databricks notebook: 02_transform.py
# PySpark transformations — mirrors etl/transform.py logic.

# COMMAND ----------
from pyspark.sql import functions as F
from pyspark.sql.types import DoubleType

DELTA_BASE = "/mnt/clinical_etl/raw"
DELTA_CLEAN = "/mnt/clinical_etl/clean"

# COMMAND ----------
# -- Transform Patients --
patients_df = spark.read.format("delta").load(f"{DELTA_BASE}/patients")

patients_clean = patients_df.withColumn(
    "gender",
    F.when(F.lower(F.col("gender")).isin("m", "male"), "M")
     .when(F.lower(F.col("gender")).isin("f", "female"), "F")
     .otherwise("UNKNOWN")
).withColumn(
    "age_band",
    F.when(F.col("anchor_age") <= 17, "PAEDIATRIC")
     .when(F.col("anchor_age") <= 40, "YOUNG_ADULT")
     .when(F.col("anchor_age") <= 65, "ADULT")
     .otherwise("ELDERLY")
).withColumn(
    "data_quality_flag",
    F.when(F.col("subject_id").isNull() | F.col("gender").isNull(), "FAIL")
     .when(F.col("anchor_age").isNull(), "WARN")
     .otherwise("PASS")
)

print("Patients transform summary:")
patients_clean.groupBy("data_quality_flag").count().display()
patients_clean.write.format("delta").mode("overwrite").save(f"{DELTA_CLEAN}/patients")

# COMMAND ----------
# -- Transform Admissions --
admissions_df = spark.read.format("delta").load(f"{DELTA_BASE}/admissions")

admissions_clean = admissions_df.withColumn(
    "admittime", F.to_timestamp("admittime")
).withColumn(
    "dischtime", F.to_timestamp("dischtime")
).withColumn(
    "los_days",
    F.round(
        (F.unix_timestamp("dischtime") - F.unix_timestamp("admittime")) / 86400.0, 2
    ).cast(DoubleType())
).withColumn(
    "admission_type", F.upper(F.trim(F.col("admission_type")))
).withColumn(
    "race", F.upper(F.trim(F.col("race")))
).withColumn(
    "data_quality_flag",
    F.when(F.col("hadm_id").isNull() | F.col("subject_id").isNull(), "FAIL")
     .when(F.col("dischtime").isNull(), "WARN")
     .otherwise("PASS")
)

print("Admissions transform summary:")
admissions_clean.groupBy("data_quality_flag").count().display()
admissions_clean.write.format("delta").mode("overwrite").save(f"{DELTA_CLEAN}/admissions")

# COMMAND ----------
# -- Transform Diagnoses --
diagnoses_df = spark.read.format("delta").load(f"{DELTA_BASE}/diagnoses")

diagnoses_clean = diagnoses_df.withColumn(
    "icd_code", F.upper(F.trim(F.col("icd_code")))
).withColumn(
    "is_valid_code",
    F.col("icd_code").isNotNull() & (F.length(F.col("icd_code")) >= 3)
)

print("Diagnoses transform summary:")
diagnoses_clean.groupBy("is_valid_code").count().display()
diagnoses_clean.write.format("delta").mode("overwrite").save(f"{DELTA_CLEAN}/diagnoses")
