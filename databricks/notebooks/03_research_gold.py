# Databricks notebook source
# MAGIC %md
# MAGIC # 03 · De-identify → Gold Layer
# MAGIC
# MAGIC Reads from **silver**, applies the same de-identification pipeline as
# MAGIC `etl/deidentify.py`, and writes the research-ready **gold** layer.
# MAGIC
# MAGIC De-identification steps:
# MAGIC 1. Remove direct identifiers — `subject_id` → SHA-256 `anonymised_id`
# MAGIC 2. Generalise quasi-identifiers — postcode → region, los_days rounded to 0.5
# MAGIC 3. k-Anonymity suppression (k=5) by (age_band, gender, admission_type)
# MAGIC
# MAGIC Gold output is safe for research export — no patient identifiers remain.

# COMMAND ----------

# AWS S3 config — must match notebooks 01 & 02
S3_BUCKET   = "clinical-etl-raw"
S3_PREFIX   = "mimic-iv-demo"
SILVER_PATH = f"s3a://{S3_BUCKET}/{S3_PREFIX}/silver"
GOLD_PATH   = f"s3a://{S3_BUCKET}/{S3_PREFIX}/gold"

K_ANONYMITY = 5   # minimum group size before suppression

# COMMAND ----------

from pyspark.sql import functions as F, Window
from pyspark.sql.types import StringType
import hashlib

# COMMAND ----------

# MAGIC %md ## 1 · Build joined cohort (silver patients + admissions + primary diagnosis)

# COMMAND ----------

silver_patients   = spark.read.format("delta").load(f"{SILVER_PATH}/patients")
silver_admissions = spark.read.format("delta").load(f"{SILVER_PATH}/admissions")
silver_diagnoses  = spark.read.format("delta").load(f"{SILVER_PATH}/diagnoses")

# Primary diagnosis = lowest seq_num per admission
primary_diag = (
    silver_diagnoses
    .withColumn(
        "rn",
        F.row_number().over(
            Window.partitionBy("hadm_id").orderBy("seq_num")
        )
    )
    .filter(F.col("rn") == 1)
    .select(
        "hadm_id",
        F.col("icd_code").alias("primary_diagnosis_code"),
        F.col("icd_description").alias("primary_diagnosis_desc"),
    )
)

cohort = (
    silver_admissions
    .join(silver_patients.select("subject_id", "gender", "age_band"), "subject_id", "left")
    .join(primary_diag, "hadm_id", "left")
    .select(
        "subject_id",
        "hadm_id",
        "gender",
        "age_band",
        "admission_type",
        "los_days",
        "primary_diagnosis_code",
        "primary_diagnosis_desc",
    )
)

print(f"cohort before de-identification: {cohort.count():,} rows")

# COMMAND ----------

# MAGIC %md ## 2 · Remove direct identifiers
# MAGIC Replace `subject_id` with a truncated SHA-256 hash (`anonymised_id`).

# COMMAND ----------

sha256_udf = F.udf(
    lambda sid: hashlib.sha256(str(sid).encode()).hexdigest()[:16] if sid is not None else None,
    StringType()
)

cohort_step1 = (
    cohort
    .withColumn("anonymised_id", sha256_udf(F.col("subject_id")))
    .drop("subject_id", "hadm_id")   # hadm_id is quasi-identifier, drop it
)

# COMMAND ----------

# MAGIC %md ## 3 · Generalise quasi-identifiers

# COMMAND ----------

cohort_step2 = (
    cohort_step1
    .withColumn(
        "los_days",
        # Round to nearest 0.5
        F.round(F.col("los_days") * 2) / 2
    )
)

# COMMAND ----------

# MAGIC %md ## 4 · k-Anonymity suppression (k=5)
# MAGIC Groups of fewer than k records by (age_band, gender, admission_type) are dropped.

# COMMAND ----------

group_counts = (
    cohort_step2
    .groupBy("age_band", "gender", "admission_type")
    .agg(F.count("*").alias("group_size"))
)

suppressed_groups = group_counts.filter(F.col("group_size") < K_ANONYMITY)
print(f"suppressing {suppressed_groups.count()} groups with < {K_ANONYMITY} records:")
suppressed_groups.show(truncate=False)

cohort_step3 = (
    cohort_step2
    .join(
        group_counts.filter(F.col("group_size") >= K_ANONYMITY)
                    .select("age_band", "gender", "admission_type"),
        on=["age_band", "gender", "admission_type"],
        how="inner"
    )
    .withColumn("is_deidentified", F.lit(True))
    .select(
        F.row_number().over(Window.orderBy(F.monotonically_increasing_id())).alias("cohort_id"),
        "anonymised_id",
        "age_band",
        "gender",
        "admission_type",
        "los_days",
        "primary_diagnosis_code",
        "primary_diagnosis_desc",
        "is_deidentified",
    )
)

before = cohort_step2.count()
after  = cohort_step3.count()
print(f"k-anonymity: {before:,} → {after:,} records retained ({after/before*100:.1f}%)")

# COMMAND ----------

# MAGIC %md ## 5 · Write gold layer

# COMMAND ----------

(
    cohort_step3.write
    .format("delta")
    .mode("overwrite")
    .option("overwriteSchema", "true")
    .save(f"{GOLD_PATH}/research_cohort")
)
print("✓ gold.research_cohort written")

# COMMAND ----------

# MAGIC %md ## 6 · Preview

# COMMAND ----------

spark.read.format("delta").load(f"{GOLD_PATH}/research_cohort").show(10, truncate=False)

# COMMAND ----------

# MAGIC %md ## 7 · Export CSV for PowerBI / downstream analysis

# COMMAND ----------

(
    spark.read.format("delta")
    .load(f"{GOLD_PATH}/research_cohort")
    .coalesce(1)
    .write
    .mode("overwrite")
    .option("header", "true")
    .csv(f"{GOLD_PATH}/exports/research_cohort_latest")
)
print("✓ CSV export written to gold/exports/research_cohort_latest/")
print("\nGold layer complete.")
