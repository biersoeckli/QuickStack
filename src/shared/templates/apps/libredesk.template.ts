import { Constants } from "@/shared/utils/constants";
import { AppTemplateModel } from "../../model/app-template.model";
import { AppExtendedModel } from "@/shared/model/app-extended.model";
import { AppTemplateUtils } from "@/server/utils/app-template.utils";
import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { getPostgresAppTemplate } from "../databases/postgres.template";
import { getRedisAppTemplate } from "../databases/redis.template";

export const libredeskAppTemplate: AppTemplateModel = {
    name: "Libredesk",
    iconName: 'https://libredesk.io/apple-touch-icon.png',
    templates: [
        // PostgreSQL Database
        getPostgresAppTemplate({
            appName: 'Libredesk PostgreSQL',
            dbName: 'libredesk',
            dbUsername: 'libredesk'
        }),
        // Redis
        getRedisAppTemplate({
            appName: 'Libredesk Redis'
        }),
        // LibreDesk App
        {
            inputSettings: [
                {
                    key: "containerImageSource",
                    label: "Container Image",
                    value: "libredesk/libredesk:v1.0.1",
                    isEnvVar: false,
                    randomGeneratedIfEmpty: false,
                }
            ],
            appModel: {
                name: "Libredesk",
                appType: 'APP',
                sourceType: 'CONTAINER',
                containerImageSource: "",
                containerCommand: 'sh',
                containerArgs: '["-c", "./libredesk --install --idempotent-install --yes --config /libredesk/config.toml && ./libredesk --upgrade --yes --config /libredesk/config.toml && ./libredesk --config /libredesk/config.toml"]',
                replicas: 1,
                ingressNetworkPolicy: Constants.DEFAULT_INGRESS_NETWORK_POLICY_APPS,
                egressNetworkPolicy: Constants.DEFAULT_EGRESS_NETWORK_POLICY_APPS,
                envVars: ``,
                useNetworkPolicy: true,
                healthCheckPeriodSeconds: Constants.DEFAULT_HEALTH_CHECK_PERIOD_SECONDS,
                healthCheckTimeoutSeconds: Constants.DEFAULT_HEALTH_CHECK_TIMEOUT_SECONDS,
                healthCheckFailureThreshold: Constants.DEFAULT_HEALTH_CHECK_FAILURE_THRESHOLD,
            },
            appDomains: [],
            appVolumes: [{
                size: 500,
                containerMountPath: '/libredesk/uploads',
                accessMode: 'ReadWriteOnce',
                storageClassName: 'longhorn',
                shareWithOtherApps: false,
            }],
            appFileMounts: [],
            appPorts: [{
                port: 9000,
            }]
        }
    ]
};

export const postCreateLibredeskAppTemplate = async (createdApps: AppExtendedModel[]): Promise<AppExtendedModel[]> => {
    const postgresApp = createdApps[0];
    const redisApp = createdApps[1];
    const libredeskApp = createdApps[2];

    if (!postgresApp || !redisApp || !libredeskApp) {
        throw new Error('Created templates for LibreDesk (PostgreSQL, Redis, or App) not found.');
    }

    // Extract PostgreSQL credentials from environment variables
    const dbModelOfProstgres = AppTemplateUtils.getDatabaseModelFromApp(postgresApp);
    const dbModelOfRedis = AppTemplateUtils.getDatabaseModelFromApp(redisApp);

    // inspired by https://github.com/easypanel-io/templates/blob/main/templates/libredesk/index.ts
    const encryptionKey = randomBytes(16).toString('hex'); // 16 bytes = 32 hex characters
    const configToml = `[app]
# Log level: info, debug, warn, error, fatal
log_level = "debug"
# Environment: dev, prod.
# Setting to "dev" will enable color logging in terminal.
env = "prod"
# Whether to automatically check for application updates on start up, app updates are shown as a banner in the admin panel.
check_updates = true
# Encryption key. Generate using \`openssl rand -hex 16\` must be 32 characters long.
encryption_key = "${encryptionKey}"

# HTTP server.
[app.server]
# Address to bind the HTTP server to.
address = "0.0.0.0:9000"
# Unix socket path (leave empty to use TCP address instead)
socket = ""
# Do NOT disable secure cookies in production environment if you don't know exactly what you're doing!
disable_secure_cookies = true
# Request read and write timeouts.
read_timeout = "5s"
write_timeout = "5s"
# Maximum request body size in bytes (100MB)
# If you are using proxy, you may need to configure them to allow larger request bodies.
max_body_size = 104857600
# Size of the read buffer for incoming requests
read_buffer_size = 4096
# Keepalive settings.
keepalive_timeout = "10s"

# File upload provider to use, either fs or s3.
[upload]
provider = "fs"

# Filesystem provider.
[upload.fs]
# Directory where uploaded files are stored, make sure this directory exists and is writable by the application.
upload_path = "uploads"

# S3 provider.
[upload.s3]
# S3 endpoint URL (required only for non-AWS S3-compatible providers like MinIO).
# Leave empty to use default AWS endpoints.
url = ""

# AWS S3 credentials, keep empty to use attached IAM roles.
access_key = ""
secret_key = ""

# AWS region, e.g., "us-east-1", "eu-west-1", etc.
region = "ap-south-1"
# S3 bucket name where files will be stored.
bucket = "bucket-name"
# Optional prefix path within the S3 bucket where files will be stored.
# Example, if set to "uploads/media", files will be stored under that path.
# Useful for organizing files inside a shared bucket.
bucket_path = ""
# S3 signed URL expiry duration (e.g., "30m", "1h")
expiry = "30m"

# Postgres.
[db]
# If running locally, use localhost.
host = "${dbModelOfProstgres.hostname}"
# Database port, default is 5432.
port = ${dbModelOfProstgres.port}
# Update the following values with your database credentials.
user = "${dbModelOfProstgres.username}"
password = "${dbModelOfProstgres.password}"
database = "${dbModelOfProstgres.databaseName}"
ssl_mode = "disable"
# Maximum number of open database connections
max_open = 30
# Maximum number of idle connections in the pool
max_idle = 30
# Maximum time a connection can be reused before being closed
max_lifetime = "300s"

# Redis.
[redis]
# If running locally, use localhost:6379.
address = "${dbModelOfRedis.hostname}:${dbModelOfRedis.port}"
password = "${dbModelOfRedis.password}"
db = 0

[message]
# Number of workers processing outgoing message queue
outgoing_queue_workers = 10
# Number of workers processing incoming message queue
incoming_queue_workers = 10
# How often to scan for outgoing messages to process, keep it low to process messages quickly.
message_outgoing_scan_interval = "50ms"
# Maximum number of messages that can be queued for incoming processing
incoming_queue_size = 5000
# Maximum number of messages that can be queued for outgoing processing
outgoing_queue_size = 5000

[notification]
# Number of concurrent notification workers
concurrency = 2
# Maximum number of notifications that can be queued
queue_size = 2000

[automation]
# Number of workers processing automation rules
worker_count = 10

[autoassigner]
# How often to run automatic conversation assignment
autoassign_interval = "5m"

[webhook]
# Number of webhook delivery workers
workers = 5
# Maximum number of webhook deliveries that can be queued
queue_size = 10000
# HTTP timeout for webhook requests
timeout = "15s"

[conversation]
# How often to check for conversations to unsnooze
unsnooze_interval = "5m"

[sla]
# How often to evaluate SLA compliance for conversations
evaluation_interval = "5m"`;

    const fileMount: Prisma.AppFileMountUncheckedCreateInput = {
        containerMountPath: '/libredesk/config.toml',
        content: configToml,
        appId: libredeskApp.id,
    };
    libredeskApp.appFileMounts.push(fileMount as any);

    // strong password generator for system user
    const systemUserPassword = AppTemplateUtils.generateStrongPasswort(52);
    libredeskApp.envVars += `LIBREDESK_SYSTEM_USER_PASSWORD=${systemUserPassword}
`;
    return [postgresApp, redisApp, libredeskApp];
};
