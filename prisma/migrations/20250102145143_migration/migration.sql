-- CreateTable
CREATE TABLE "VolumeBackup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "volumeId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "cron" TEXT NOT NULL,
    "retention" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VolumeBackup_volumeId_fkey" FOREIGN KEY ("volumeId") REFERENCES "AppVolume" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VolumeBackup_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "S3Target" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
