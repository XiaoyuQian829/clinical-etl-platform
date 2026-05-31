"""
Upload raw MIMIC-IV CSV files to S3, ready for Databricks notebooks.

Usage:
    python databricks/upload_to_s3.py

Requires:
    pip install boto3
    AWS credentials configured (aws configure, or IAM role)

What it does:
    1. Uploads data/raw/*.csv → s3://<BUCKET>/<PREFIX>/raw/
    2. Prints S3 paths to confirm
"""

import boto3
import os
from pathlib import Path

# ---------------------------------------------------------------------------
# Config — edit these or set as environment variables
# ---------------------------------------------------------------------------
S3_BUCKET = os.getenv("S3_BUCKET", "clinical-etl-raw")
S3_PREFIX = os.getenv("S3_PREFIX", "mimic-iv-demo")
AWS_REGION = os.getenv("AWS_REGION", "ap-southeast-2")

RAW_DATA_DIR = Path(__file__).parent.parent / "data" / "raw"

FILES = [
    # Core
    "patients.csv",
    "admissions.csv",
    "diagnoses_icd.csv",
    # Reference tables
    "d_icd_diagnoses.csv",
    "d_icd_procedures.csv",
    "d_labitems.csv",
    "d_hcpcs.csv",
    "d_items.csv",
    # Hosp clinical
    "drgcodes.csv",
    "services.csv",
    "transfers.csv",
    "hcpcsevents.csv",
    "omr.csv",
    "procedures_icd.csv",
    "microbiologyevents.csv",
    "poe.csv",
    "poe_detail.csv",
    "pharmacy.csv",
    "emar.csv",
    "emar_detail.csv",
    "prescriptions.csv",
    "labevents.csv",        # 107K rows
    # ICU
    "icustays.csv",
    "inputevents.csv",
    "outputevents.csv",
    "procedureevents.csv",
    "datetimeevents.csv",
    "ingredientevents.csv",
    "chartevents.csv",      # 668K rows
]

# ---------------------------------------------------------------------------

def upload():
    s3 = boto3.client("s3", region_name=AWS_REGION)

    # Create bucket if it doesn't exist
    try:
        s3.head_bucket(Bucket=S3_BUCKET)
        print(f"Bucket s3://{S3_BUCKET} already exists")
    except s3.exceptions.ClientError:
        print(f"Creating bucket s3://{S3_BUCKET} in {AWS_REGION} ...")
        if AWS_REGION == "us-east-1":
            s3.create_bucket(Bucket=S3_BUCKET)
        else:
            s3.create_bucket(
                Bucket=S3_BUCKET,
                CreateBucketConfiguration={"LocationConstraint": AWS_REGION},
            )
        print(f"  ✓ bucket created")

    print(f"\nUploading from {RAW_DATA_DIR}/\n")

    for filename in FILES:
        local_path = RAW_DATA_DIR / filename
        if not local_path.exists():
            print(f"  [skip] {filename} not found at {local_path}")
            continue

        s3_key = f"{S3_PREFIX}/raw/{filename}"
        size_mb = local_path.stat().st_size / 1_048_576

        print(f"  uploading {filename} ({size_mb:.1f} MB) ...", end=" ", flush=True)
        s3.upload_file(str(local_path), S3_BUCKET, s3_key)
        print(f"✓  s3://{S3_BUCKET}/{s3_key}")

    print(f"\nAll files uploaded.")
    print(f"\nSet these in your Databricks notebooks:")
    print(f'  S3_BUCKET = "{S3_BUCKET}"')
    print(f'  S3_PREFIX = "{S3_PREFIX}"')
    print(f'  RAW_PATH  = "s3a://{S3_BUCKET}/{S3_PREFIX}/raw"')


if __name__ == "__main__":
    upload()
