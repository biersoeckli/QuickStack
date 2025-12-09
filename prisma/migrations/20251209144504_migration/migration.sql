-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_VolumeBackup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "volumeId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "cron" TEXT NOT NULL,
    "retention" INTEGER NOT NULL,
    "useDatabaseBackup" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VolumeBackup_volumeId_fkey" FOREIGN KEY ("volumeId") REFERENCES "AppVolume" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VolumeBackup_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "S3Target" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_VolumeBackup" ("createdAt", "cron", "id", "retention", "targetId", "updatedAt", "volumeId") SELECT "createdAt", "cron", "id", "retention", "targetId", "updatedAt", "volumeId" FROM "VolumeBackup";
DROP TABLE "VolumeBackup";
ALTER TABLE "new_VolumeBackup" RENAME TO "VolumeBackup";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
