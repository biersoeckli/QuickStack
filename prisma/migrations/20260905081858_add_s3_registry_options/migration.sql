-- RedefineTables
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
    "useSsl" BOOLEAN NOT NULL DEFAULT true,
    "v4Auth" BOOLEAN NOT NULL DEFAULT true,
    "forcePathStyle" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_S3Target" ("accessKeyId", "bucketName", "createdAt", "endpoint", "id", "name", "region", "secretKey", "updatedAt") SELECT "accessKeyId", "bucketName", "createdAt", "endpoint", "id", "name", "region", "secretKey", "updatedAt" FROM "S3Target";
DROP TABLE "S3Target";
ALTER TABLE "new_S3Target" RENAME TO "S3Target";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
