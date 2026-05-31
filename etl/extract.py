from __future__ import annotations
import json
from pathlib import Path
from typing import Any
import pandas as pd


def extract_patients_csv(filepath: str) -> list[dict]:
    df = pd.read_csv(filepath)
    df = df.where(pd.notna(df), None)
    records = df.to_dict(orient="records")
    print(f"[extract] patients: {len(records)} records from {filepath}")
    return records


def extract_admissions_csv(filepath: str) -> list[dict]:
    df = pd.read_csv(filepath, parse_dates=["admittime", "dischtime", "deathtime", "edregtime", "edouttime"])
    df = df.where(pd.notna(df), None)
    records = df.to_dict(orient="records")
    print(f"[extract] admissions: {len(records)} records from {filepath}")
    return records


def extract_diagnoses_csv(filepath: str) -> list[dict]:
    df = pd.read_csv(filepath)
    df = df.where(pd.notna(df), None)
    records = df.to_dict(orient="records")
    print(f"[extract] diagnoses: {len(records)} records from {filepath}")
    return records


def extract_fhir_json(filepath: str) -> list[dict]:
    with open(filepath) as f:
        data = json.load(f)

    resources: list[dict] = []
    if isinstance(data, dict):
        if data.get("resourceType") == "Bundle":
            for entry in data.get("entry", []):
                resource = entry.get("resource", {})
                if resource.get("resourceType") == "Patient":
                    resources.append(resource)
        elif data.get("resourceType") == "Patient":
            resources.append(data)
    elif isinstance(data, list):
        resources = [r for r in data if isinstance(r, dict) and r.get("resourceType") == "Patient"]

    print(f"[extract] fhir patients: {len(resources)} resources from {filepath}")
    return resources


def extract_csv(filepath: str, parse_dates: list[str] | None = None) -> list[dict]:
    """Generic CSV extractor — reads any file, returns list of dicts."""
    kwargs: dict = {"dtype": str}  # read everything as str, type coercion happens in load
    if parse_dates:
        kwargs = {"parse_dates": parse_dates}
    df = pd.read_csv(filepath, **kwargs)
    df = df.where(pd.notna(df), None)
    records = df.to_dict(orient="records")
    name = Path(filepath).stem
    print(f"[extract] {name}: {len(records):,} records from {filepath}")
    return records


def extract_from_s3(bucket: str, key: str) -> bytes:
    import boto3
    s3 = boto3.client("s3")
    response = s3.get_object(Bucket=bucket, Key=key)
    data: bytes = response["Body"].read()
    print(f"[extract] s3://{bucket}/{key}: {len(data)} bytes downloaded")
    return data
