# Databricks notebook source
# MAGIC %md
# MAGIC # 02 · Transform → Silver Layer
# MAGIC
# MAGIC Reads from Delta **bronze**, applies the same business rules as the
# MAGIC local ETL pipeline (`etl/transform.py`), and writes to **silver**.
# MAGIC
# MAGIC Silver = validated, standardised, ICD descriptions joined.
# MAGIC No de-identification yet — that happens in notebook 03.

# COMMAND ----------

# AWS S3 config — must match notebook 01
S3_BUCKET   = "clinical-etl-raw"
S3_PREFIX   = "mimic-iv-demo"
BRONZE_PATH = f"s3a://{S3_BUCKET}/{S3_PREFIX}/bronze"
SILVER_PATH = f"s3a://{S3_BUCKET}/{S3_PREFIX}/silver"

# COMMAND ----------

from pyspark.sql import functions as F, DataFrame
from pyspark.sql.types import StringType, DoubleType

# COMMAND ----------

# MAGIC %md ## 1 · Silver patients
# MAGIC - Normalise gender → M / F / UNKNOWN
# MAGIC - Derive age_band from anchor_age
# MAGIC - Compute data_quality_flag

# COMMAND ----------

bronze_patients = spark.read.format("delta").load(f"{BRONZE_PATH}/patients")

silver_patients = (
    bronze_patients
    .withColumn(
        "gender",
        F.when(F.lower(F.col("gender")).isin("m", "male"),   F.lit("M"))
         .when(F.lower(F.col("gender")).isin("f", "female"), F.lit("F"))
         .otherwise(F.lit("UNKNOWN"))
    )
    .withColumn(
        "age_band",
        F.when(F.col("anchor_age") <= 17,  F.lit("PAEDIATRIC"))
         .when(F.col("anchor_age") <= 40,  F.lit("YOUNG_ADULT"))
         .when(F.col("anchor_age") <= 65,  F.lit("ADULT"))
         .when(F.col("anchor_age") > 65,   F.lit("ELDERLY"))
         .otherwise(F.lit("UNKNOWN"))
    )
    .withColumn(
        "data_quality_flag",
        F.when(
            F.col("subject_id").isNull() | F.col("gender").isNull() |
            F.col("anchor_age").isNull() | F.col("anchor_year").isNull(),
            F.lit("FAIL")
        ).otherwise(F.lit("PASS"))
    )
    .drop("_source_file")
)

print(f"silver patients: {silver_patients.count():,} rows")
silver_patients.groupBy("data_quality_flag").count().show()

(
    silver_patients.write
    .format("delta")
    .mode("overwrite")
    .option("overwriteSchema", "true")
    .save(f"{SILVER_PATH}/patients")
)
print("✓ silver.patients written")

# COMMAND ----------

# MAGIC %md ## 2 · Silver admissions
# MAGIC - Parse admittime / dischtime as timestamps
# MAGIC - Compute los_days (length of stay)
# MAGIC - Uppercase admission_type, race, admission_location, discharge_location
# MAGIC - data_quality_flag

# COMMAND ----------

bronze_admissions = spark.read.format("delta").load(f"{BRONZE_PATH}/admissions")

silver_admissions = (
    bronze_admissions
    .withColumn("admittime", F.to_timestamp("admittime"))
    .withColumn("dischtime",  F.to_timestamp("dischtime"))
    .withColumn("deathtime",  F.to_timestamp("deathtime"))
    .withColumn(
        "los_days",
        F.round(
            (F.unix_timestamp("dischtime") - F.unix_timestamp("admittime")) / 86400.0,
            2
        )
    )
    .withColumn("admission_type",      F.upper(F.trim(F.col("admission_type"))))
    .withColumn("race",                F.upper(F.trim(F.col("race"))))
    .withColumn("admission_location",  F.upper(F.trim(F.col("admission_location"))))
    .withColumn("discharge_location",  F.upper(F.trim(F.col("discharge_location"))))
    .withColumn(
        "data_quality_flag",
        F.when(
            F.col("hadm_id").isNull()       | F.col("subject_id").isNull() |
            F.col("admittime").isNull()      | F.col("admission_type").isNull(),
            F.lit("FAIL")
        ).otherwise(F.lit("PASS"))
    )
    .drop("_source_file")
)

print(f"silver admissions: {silver_admissions.count():,} rows")

(
    silver_admissions.write
    .format("delta")
    .mode("overwrite")
    .option("overwriteSchema", "true")
    .save(f"{SILVER_PATH}/admissions")
)
print("✓ silver.admissions written")

# COMMAND ----------

# MAGIC %md ## 3 · Silver diagnoses
# MAGIC - Uppercase ICD codes
# MAGIC - LEFT JOIN icd_reference for diagnosis descriptions (100% coverage)
# MAGIC - is_valid_code flag

# COMMAND ----------

bronze_diagnoses = spark.read.format("delta").load(f"{BRONZE_PATH}/diagnoses")
bronze_icd_ref   = spark.read.format("delta").load(f"{BRONZE_PATH}/icd_reference")

# Normalise ICD reference key
icd_ref_clean = (
    bronze_icd_ref
    .withColumn("icd_code_upper", F.upper(F.trim(F.col("icd_code"))))
    .select("icd_code_upper", F.col("long_title").alias("icd_description"), "icd_version")
)

silver_diagnoses = (
    bronze_diagnoses
    .withColumn("icd_code",    F.upper(F.trim(F.col("icd_code"))))
    .withColumn("icd_version", F.col("icd_version").cast("int"))
    .withColumn("is_valid_code", F.length(F.col("icd_code")) >= 3)
    .join(
        icd_ref_clean,
        (F.col("icd_code") == icd_ref_clean["icd_code_upper"]) &
        (F.col("icd_version") == icd_ref_clean["icd_version"]),
        how="left"
    )
    .withColumn("icd_description", F.coalesce(F.col("icd_description"), F.lit("Unknown")))
    .drop("icd_code_upper", "_source_file")
)

total   = silver_diagnoses.count()
matched = silver_diagnoses.filter(F.col("icd_description") != "Unknown").count()
print(f"silver diagnoses: {total:,} rows, {matched:,} with description ({matched/total*100:.1f}%)")

(
    silver_diagnoses.write
    .format("delta")
    .mode("overwrite")
    .option("overwriteSchema", "true")
    .save(f"{SILVER_PATH}/diagnoses")
)
print("✓ silver.diagnoses written")

# COMMAND ----------

# MAGIC %md ## 4 · Summary

# COMMAND ----------

for name, path in [
    ("silver.patients",   f"{SILVER_PATH}/patients"),
    ("silver.admissions", f"{SILVER_PATH}/admissions"),
    ("silver.diagnoses",  f"{SILVER_PATH}/diagnoses"),
]:
    count = spark.read.format("delta").load(path).count()
    print(f"  {name}: {count:,} rows")

print("\nSilver transformation complete.")
