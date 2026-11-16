-- Monitoring history is beta data: discard existing App and Node samples.
DROP TABLE "AppMonitoringSample";
DROP TABLE "NodeMonitoringSample";

CREATE TABLE "MonitoringSample" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "sampledAt" DATETIME NOT NULL,
  "measuredAt" DATETIME,
  "appId" TEXT,
  "nodeName" TEXT,
  "cpuCores" REAL,
  "ramBytes" REAL,
  "nodeFilesystemUsedBytes" REAL,
  CONSTRAINT "MonitoringSample_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MonitoringSample_owner_check" CHECK (("appId" IS NOT NULL AND "nodeName" IS NULL) OR ("appId" IS NULL AND "nodeName" IS NOT NULL)),
  CONSTRAINT "MonitoringSample_storage_check" CHECK ("appId" IS NULL OR "nodeFilesystemUsedBytes" IS NULL)
);
CREATE INDEX "MonitoringSample_appId_sampledAt_idx" ON "MonitoringSample"("appId", "sampledAt");
CREATE INDEX "MonitoringSample_nodeName_sampledAt_idx" ON "MonitoringSample"("nodeName", "sampledAt");
CREATE INDEX "MonitoringSample_sampledAt_idx" ON "MonitoringSample"("sampledAt");
