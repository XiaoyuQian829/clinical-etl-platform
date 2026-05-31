from __future__ import annotations
import os
import json
from datetime import datetime, timezone
import boto3
from botocore.exceptions import ClientError

TABLE_NAME = os.getenv("DYNAMODB_TABLE", "clinical_etl_fhir")
REGION     = os.getenv("AWS_REGION", "ap-southeast-2")


def get_table():
    dynamodb = boto3.resource("dynamodb", region_name=REGION)
    return dynamodb.Table(TABLE_NAME)


def create_table_if_not_exists() -> None:
    dynamodb = boto3.resource("dynamodb", region_name=REGION)
    try:
        table = dynamodb.create_table(
            TableName=TABLE_NAME,
            KeySchema=[{"AttributeName": "subject_id", "KeyType": "HASH"}],
            AttributeDefinitions=[{"AttributeName": "subject_id", "AttributeType": "S"}],
            BillingMode="PAY_PER_REQUEST",
        )
        table.wait_until_exists()
        print(f"[dynamodb] Table {TABLE_NAME} created")
    except ClientError as e:
        if e.response["Error"]["Code"] == "ResourceInUseException":
            print(f"[dynamodb] Table {TABLE_NAME} already exists")
        else:
            raise


def ingest_fhir_document(fhir_json: dict) -> dict:
    if fhir_json.get("resourceType") != "Patient":
        raise ValueError(f"Expected resourceType=Patient, got {fhir_json.get('resourceType')}")

    subject_id = fhir_json.get("id")
    if not subject_id:
        raise ValueError("FHIR Patient document must have an 'id' field (subject_id)")

    item = {
        "subject_id": str(subject_id),
        "resourceType": "Patient",
        "document": json.dumps(fhir_json),
        "ingested_at": datetime.now(timezone.utc).isoformat(),
    }

    table = get_table()
    table.put_item(Item=item)
    print(f"[dynamodb] Ingested FHIR Patient subject_id={subject_id} at {item['ingested_at']}")

    count = table.scan(Select="COUNT")["Count"]
    print(f"[dynamodb] Table {TABLE_NAME} now has {count} items")
    return item


def get_fhir_by_subject_id(subject_id: str) -> dict | None:
    table = get_table()
    response = table.get_item(Key={"subject_id": str(subject_id)})
    item = response.get("Item")
    if item:
        item["document"] = json.loads(item["document"])
        print(f"[dynamodb] Found FHIR document for subject_id={subject_id}")
    else:
        print(f"[dynamodb] No document found for subject_id={subject_id}")
    return item
