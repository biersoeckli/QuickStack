-- S3Target.endpoint is the sole source of truth for HTTP versus HTTPS.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_S3Target" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "bucketName" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "accessKeyId" TEXT NOT NULL,
    "secretKey" TEXT NOT NULL,
    "v4Auth" BOOLEAN NOT NULL DEFAULT true,
    "forcePathStyle" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "new_S3Target" ("id", "name", "bucketName", "endpoint", "region", "accessKeyId", "secretKey", "v4Auth", "forcePathStyle", "createdAt", "updatedAt")
SELECT "id", "name", "bucketName", "endpoint", "region", "accessKeyId", "secretKey", "v4Auth", "forcePathStyle", "createdAt", "updatedAt"
FROM "S3Target";

DROP TABLE "S3Target";
ALTER TABLE "new_S3Target" RENAME TO "S3Target";

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
