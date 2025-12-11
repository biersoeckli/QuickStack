#!/bin/bash
set -e

echo ""
echo ""
echo "*************************************************************"
echo "QuickStack PostgreSQL Backup Script Version: ${VERSION:-unknown}"
echo "*************************************************************"
echo ""

# Check required env vars
if [ -z "$POSTGRES_HOST" ]; then echo "Error: POSTGRES_HOST is not set"; exit 1; fi
if [ -z "$POSTGRES_PORT" ]; then echo "Error: POSTGRES_PORT is not set"; exit 1; fi
if [ -z "$POSTGRES_USER" ]; then echo "Error: POSTGRES_USER is not set"; exit 1; fi
if [ -z "$POSTGRES_PASSWORD" ]; then echo "Error: POSTGRES_PASSWORD is not set"; exit 1; fi
if [ -z "$POSTGRES_DB" ]; then echo "Error: POSTGRES_DB is not set"; exit 1; fi
if [ -z "$S3_ENDPOINT" ]; then echo "Error: S3_ENDPOINT is not set"; exit 1; fi
if [ -z "$S3_ACCESS_KEY_ID" ]; then echo "Error: S3_ACCESS_KEY_ID is not set"; exit 1; fi
if [ -z "$S3_SECRET_KEY" ]; then echo "Error: S3_SECRET_KEY is not set"; exit 1; fi
if [ -z "$S3_BUCKET_NAME" ]; then echo "Error: S3_BUCKET_NAME is not set"; exit 1; fi
if [ -z "$S3_KEY" ]; then echo "Error: S3_KEY is not set"; exit 1; fi
if [ -z "$S3_REGION" ]; then echo "Error: S3_REGION is not set"; exit 1; fi

echo "Starting backup process..."

# Create a temporary directory for the dump
WORK_DIR=$(mktemp -d)
DUMP_FILE="$WORK_DIR/backup.sql"
ZIP_FILE="$WORK_DIR/backup.zip"

# Set PGPASSWORD for pg_dump
export PGPASSWORD="$POSTGRES_PASSWORD"

# Run pg_dump
echo "Running pg_dump..."
pg_dump -h "$POSTGRES_HOST" \
        -p "$POSTGRES_PORT" \
        -U "$POSTGRES_USER" \
        -d "$POSTGRES_DB" \
        -F p \
        -f "$DUMP_FILE"

# Check if dump was successful (file exists and is not empty)
if [ ! -f "$DUMP_FILE" ] || [ ! -s "$DUMP_FILE" ]; then
    echo "Error: pg_dump failed or produced no output."
    exit 1
fi

# Zip the dump
echo "Zipping dump..."
cd "$WORK_DIR"
zip "$ZIP_FILE" "backup.sql"

# Configure AWS CLI environment variables
export AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$S3_SECRET_KEY"
export AWS_DEFAULT_REGION="$S3_REGION"

# Upload to S3
echo "Uploading to S3..."
echo "Destination: s3://$S3_BUCKET_NAME/$S3_KEY"
echo "Endpoint: $S3_ENDPOINT"

aws s3 cp "$ZIP_FILE" "s3://$S3_BUCKET_NAME/$S3_KEY" --endpoint-url "$S3_ENDPOINT"

# Cleanup
echo "Cleaning up..."
rm -rf "$WORK_DIR"

echo ""
echo "******************************"
echo "Backup completed successfully."
echo "******************************"
echo ""
echo ""
