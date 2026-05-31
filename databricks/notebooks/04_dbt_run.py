# Databricks notebook source
# MAGIC %md
# MAGIC # 04 · DBT Run (optional — SQL-based medallion variant)
# MAGIC
# MAGIC This notebook runs DBT models against a PostgreSQL target instead of
# MAGIC Delta Lake. Use this when the downstream system is PostgreSQL rather
# MAGIC than a lakehouse. The Databricks notebooks 01–03 handle the
# MAGIC Delta Lake path; this notebook handles the SQL warehouse path.
# MAGIC
# MAGIC Requires:
# MAGIC - `dbt-postgres` installed in the cluster library
# MAGIC - DBT project mounted at `/dbfs/FileStore/clinical-etl/dbt`
# MAGIC - PostgreSQL connection details in the widget below

# COMMAND ----------

# MAGIC %md ## Configuration

# COMMAND ----------

dbutils.widgets.text("pg_host",     "your-rds-endpoint.amazonaws.com", "PostgreSQL host")
dbutils.widgets.text("pg_database", "clinicaldb",                       "Database name")
dbutils.widgets.text("pg_user",     "clinicaladmin",                    "DB user")
dbutils.widgets.text("pg_port",     "5432",                             "Port")

PG_HOST     = dbutils.widgets.get("pg_host")
PG_DATABASE = dbutils.widgets.get("pg_database")
PG_USER     = dbutils.widgets.get("pg_user")
PG_PORT     = dbutils.widgets.get("pg_port")

# Store password in Databricks Secrets — never hardcode
PG_PASSWORD = dbutils.secrets.get(scope="clinical-etl", key="pg_password")

# COMMAND ----------

# MAGIC %md ## Run DBT

# COMMAND ----------

import subprocess, os

dbt_env = {
    **os.environ,
    "PG_HOST":     PG_HOST,
    "PG_DATABASE": PG_DATABASE,
    "PG_USER":     PG_USER,
    "PG_PASSWORD": PG_PASSWORD,
    "PG_PORT":     PG_PORT,
}

DBT_PROJECT_DIR = "/dbfs/FileStore/clinical-etl/dbt"
DBT_PROFILES_DIR = DBT_PROJECT_DIR

# COMMAND ----------

# Run all models
result = subprocess.run(
    ["dbt", "run",
     "--project-dir", DBT_PROJECT_DIR,
     "--profiles-dir", DBT_PROFILES_DIR],
    capture_output=True, text=True, env=dbt_env
)

print("=== DBT STDOUT ===")
print(result.stdout[-3000:] if len(result.stdout) > 3000 else result.stdout)

if result.returncode != 0:
    print("=== DBT STDERR ===")
    print(result.stderr[-2000:])
    raise Exception(f"dbt run failed (exit code {result.returncode})")

print("✓ dbt run complete")

# COMMAND ----------

# Run DBT tests
test_result = subprocess.run(
    ["dbt", "test",
     "--project-dir", DBT_PROJECT_DIR,
     "--profiles-dir", DBT_PROFILES_DIR],
    capture_output=True, text=True, env=dbt_env
)

print("=== DBT TEST ===")
print(test_result.stdout[-3000:] if len(test_result.stdout) > 3000 else test_result.stdout)

if test_result.returncode != 0:
    raise Exception("dbt tests failed — check output above")

print("✓ All DBT tests passing")
