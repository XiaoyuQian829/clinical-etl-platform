# Databricks notebook: 04_load.py
# Loads clean Delta tables into PostgreSQL via JDBC.
# Credentials stored in Databricks secrets (scope: clinical_etl).

# COMMAND ----------
from pyspark.sql import functions as F

DELTA_CLEAN = "/mnt/clinical_etl/clean"

# Read credentials from Databricks secret scope
PG_HOST = dbutils.secrets.get("clinical_etl", "pg_host")
PG_USER = dbutils.secrets.get("clinical_etl", "pg_user")
PG_PASS = dbutils.secrets.get("clinical_etl", "pg_password")
PG_DB   = dbutils.secrets.get("clinical_etl", "pg_db")

JDBC_URL = f"jdbc:postgresql://{PG_HOST}:5432/{PG_DB}"
JDBC_PROPS = {
    "user":     PG_USER,
    "password": PG_PASS,
    "driver":   "org.postgresql.Driver",
}

# COMMAND ----------
# -- Load clean patients --
patients_df = spark.read.format("delta").load(f"{DELTA_CLEAN}/patients")
patients_df.write.jdbc(
    url=JDBC_URL, table="clean.patients",
    mode="overwrite", properties=JDBC_PROPS
)
print(f"Loaded {patients_df.count()} patients into clean.patients")

# COMMAND ----------
# -- Load clean admissions --
admissions_df = spark.read.format("delta").load(f"{DELTA_CLEAN}/admissions")
admissions_df.write.jdbc(
    url=JDBC_URL, table="clean.admissions",
    mode="overwrite", properties=JDBC_PROPS
)
print(f"Loaded {admissions_df.count()} admissions into clean.admissions")

# COMMAND ----------
# -- Load clean diagnoses --
diagnoses_df = spark.read.format("delta").load(f"{DELTA_CLEAN}/diagnoses")
diagnoses_df.write.jdbc(
    url=JDBC_URL, table="clean.diagnoses",
    mode="overwrite", properties=JDBC_PROPS
)
print(f"Loaded {diagnoses_df.count()} diagnoses into clean.diagnoses")
