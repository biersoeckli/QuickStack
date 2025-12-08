#!/bin/bash
set -e

# Check required env vars
if [ -z "$MONGODB_URI" ]; then echo "Error: MONGODB_URI is not set"; exit 1; fi
if [ -z "$S3_ENDPOINT" ]; then echo "Error: S3_ENDPOINT is not set"; exit 1; fi
if [ -z "$S3_ACCESS_KEY_ID" ]; then echo "Error: S3_ACCESS_KEY_ID is not set"; exit 1; fi
if [ -z "$S3_SECRET_KEY" ]; then echo "Error: S3_SECRET_KEY is not set"; exit 1; fi
if [ -z "$S3_BUCKET_NAME" ]; then echo "Error: S3_BUCKET_NAME is not set"; exit 1; fi
if [ -z "$S3_KEY" ]; then echo "Error: S3_KEY is not set"; exit 1; fi
if [ -z "$S3_REGION" ]; then echo "Error: S3_REGION is not set"; exit 1; fi

echo "Starting backup process..."

# Create a temporary directory for the dump
WORK_DIR=$(mktemp -d)
DUMP_DIR="$WORK_DIR/dump"
ZIP_FILE="$WORK_DIR/backup.zip"

# Run mongodump
echo "Running mongodump..."
# --forceTableScan might be needed if the user doesn't have administrative privileges but usually for backups they do.
# We dump to a directory to zip it later as requested.
mongodump --uri="$MONGODB_URI" --forceTableScan --out="$DUMP_DIR"

# Check if dump was successful (directory exists and is not empty)
if [ ! -d "$DUMP_DIR" ] || [ -z "$(ls -A $DUMP_DIR)" ]; then
    echo "Error: Mongodump failed or produced no output."
    exit 1
fi

# Zip the dump
echo "Zipping dump..."
cd "$DUMP_DIR"
zip -r "$ZIP_FILE" .
cd "$WORK_DIR"

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

echo "Backup completed successfully."
