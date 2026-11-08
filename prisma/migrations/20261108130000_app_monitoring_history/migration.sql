CREATE TABLE "AppMonitoringSample" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sampledAt" DATETIME NOT NULL,
    "appId" TEXT NOT NULL,
    "cpuCores" REAL,
    "ramBytes" REAL,
    "measuredAt" DATETIME,
    CONSTRAINT "AppMonitoringSample_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "AppMonitoringSample_appId_sampledAt_idx" ON "AppMonitoringSample"("appId", "sampledAt");
CREATE INDEX "AppMonitoringSample_sampledAt_idx" ON "AppMonitoringSample"("sampledAt");
CREATE TABLE "AppVolumeMonitoringSample" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sampledAt" DATETIME NOT NULL,
    "volumeId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "usedBytes" REAL,
    "availableBytes" REAL,
    "capacityBytes" REAL,
    "measuredAt" DATETIME,
    CONSTRAINT "AppVolumeMonitoringSample_volumeId_fkey" FOREIGN KEY ("volumeId") REFERENCES "AppVolume" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "AppVolumeMonitoringSample_volumeId_sampledAt_idx" ON "AppVolumeMonitoringSample"("volumeId", "sampledAt");
CREATE INDEX "AppVolumeMonitoringSample_sampledAt_idx" ON "AppVolumeMonitoringSample"("sampledAt");

CREATE TABLE "AppVolumeMonitoringMembership" (
    "sampleId" TEXT NOT NULL,
    "volumeId" TEXT NOT NULL,
    PRIMARY KEY ("sampleId", "volumeId"),
    CONSTRAINT "AppVolumeMonitoringMembership_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "AppVolumeMonitoringSample" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AppVolumeMonitoringMembership_volumeId_fkey" FOREIGN KEY ("volumeId") REFERENCES "AppVolume" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "AppVolumeMonitoringMembership_volumeId_idx" ON "AppVolumeMonitoringMembership"("volumeId");
