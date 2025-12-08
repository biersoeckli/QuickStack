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

# Get list of all databases
echo "Fetching list of databases..."
DATABASES=$(mongosh "$MONGODB_URI" --quiet --eval "db.adminCommand('listDatabases').databases.map(d => d.name).join(' ')")

if [ -z "$DATABASES" ]; then
    echo "Error: No databases found or failed to list databases."
    exit 1
fi

echo "Found databases: $DATABASES"

# Create dump directory
mkdir -p "$DUMP_DIR"

# Dump each database separately
for DB in $DATABASES; do
    # Skip admin, config, and local databases (system databases)
    if [ "$DB" = "admin" ] || [ "$DB" = "config" ] || [ "$DB" = "local" ]; then
        echo "Skipping system database: $DB"
        continue
    fi

    echo "Dumping database: $DB"
    mongodump --uri="$MONGODB_URI" --db="$DB" --forceTableScan --out="$DUMP_DIR"

    if [ $? -ne 0 ]; then
        echo "Warning: Failed to dump database $DB, continuing with others..."
    fi
done

# Check if dump was successful (directory exists and is not empty)
if [ ! -d "$DUMP_DIR" ] || [ -z "$(ls -A $DUMP_DIR)" ]; then
    echo "Error: No databases were dumped successfully."
    exit 1
fi

# Zip all dumps
echo "Zipping all dumps..."
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
