#!/bin/bash
set -e

echo ""
echo ""
echo "*************************************************************"
echo "QuickStack MariaDB/MySQL Backup Script Version: ${VERSION:-unknown}"
echo "*************************************************************"
echo ""

# Check required env vars
if [ -z "$MYSQL_HOST" ]; then echo "Error: MYSQL_HOST is not set"; exit 1; fi
if [ -z "$MYSQL_PORT" ]; then echo "Error: MYSQL_PORT is not set"; exit 1; fi
if [ -z "$MYSQL_USER" ]; then echo "Error: MYSQL_USER is not set"; exit 1; fi
if [ -z "$MYSQL_PASSWORD" ]; then echo "Error: MYSQL_PASSWORD is not set"; exit 1; fi
if [ -z "$MYSQL_DATABASE" ]; then echo "Error: MYSQL_DATABASE is not set"; exit 1; fi
if [ -z "$S3_ENDPOINT" ]; then echo "Error: S3_ENDPOINT is not set"; exit 1; fi
if [ -z "$S3_ACCESS_KEY_ID" ]; then echo "Error: S3_ACCESS_KEY_ID is not set"; exit 1; fi
if [ -z "$S3_SECRET_KEY" ]; then echo "Error: S3_SECRET_KEY is not set"; exit 1; fi
if [ -z "$S3_BUCKET_NAME" ]; then echo "Error: S3_BUCKET_NAME is not set"; exit 1; fi
if [ -z "$S3_KEY" ]; then echo "Error: S3_KEY is not set"; exit 1; fi
if [ -z "$S3_REGION" ]; then echo "Error: S3_REGION is not set"; exit 1; fi

# Insert a sleep timeout so that the network policy is fully applied before attempting to connect to the database
echo "Waiting for network policies to take effect..."
sleep 4

echo "Starting backup process..."

# Create a temporary directory for the dump
WORK_DIR=$(mktemp -d)
DUMP_FILE="$WORK_DIR/backup.sql"
TAR_FILE="$WORK_DIR/backup.tar.gz"

# Run mariadb-dump (mysqldump)
echo "Running mariadb-dump..."
mariadb-dump -h "$MYSQL_HOST" \
             -P "$MYSQL_PORT" \
             -u "$MYSQL_USER" \
             -p"$MYSQL_PASSWORD" \
             --single-transaction \
             --routines \
             --triggers \
             --events \
             --skip-ssl \
             "$MYSQL_DATABASE" > "$DUMP_FILE"

# Check if dump was successful (file exists and is not empty)
if [ ! -f "$DUMP_FILE" ] || [ ! -s "$DUMP_FILE" ]; then
    echo "Error: mariadb-dump failed or produced no output."
    exit 1
fi

# Create tar.gz archive
echo "Creating tar.gz archive..."
cd "$WORK_DIR"
tar -czf "$TAR_FILE" "backup.sql"

# Configure AWS CLI environment variables
export AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$S3_SECRET_KEY"
export AWS_DEFAULT_REGION="$S3_REGION"

# Apply advanced S3 options (addressing style + signature version) when provided by QuickStack
if [ -n "$S3_FORCE_PATH_STYLE" ] || [ -n "$S3_V4AUTH" ]; then
    AWS_CONFIG_FILE="${AWS_CONFIG_FILE:-$HOME/.aws/config}"
    mkdir -p "$(dirname "$AWS_CONFIG_FILE")"

    ADDRESSING_STYLE="virtual"
    if [ "$S3_FORCE_PATH_STYLE" = "true" ]; then
        ADDRESSING_STYLE="path"
    fi
    SIGNATURE_VERSION="s3v4"
    if [ "$S3_V4AUTH" = "false" ]; then
        SIGNATURE_VERSION="s3"
    fi

    printf '[default]\ns3 =\n  addressing_style = %s\n  signature_version = %s\n' "$ADDRESSING_STYLE" "$SIGNATURE_VERSION" > "$AWS_CONFIG_FILE"
    export AWS_CONFIG_FILE
    echo "S3 addressing style: $ADDRESSING_STYLE (signature $SIGNATURE_VERSION)"
fi

# Upload to S3
echo "Uploading to S3..."
echo "Destination: s3://$S3_BUCKET_NAME/$S3_KEY"
echo "Endpoint: $S3_ENDPOINT"

aws s3 cp "$TAR_FILE" "s3://$S3_BUCKET_NAME/$S3_KEY" --endpoint-url "$S3_ENDPOINT"

# Cleanup
echo "Cleaning up..."
rm -rf "$WORK_DIR"

echo ""
echo "******************************"
echo "Backup completed successfully."
echo "******************************"
echo ""
echo ""
