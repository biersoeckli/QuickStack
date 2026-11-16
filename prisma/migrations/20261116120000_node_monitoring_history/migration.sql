CREATE TABLE "NodeMonitoringSample" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "sampledAt" DATETIME NOT NULL,
  "nodeName" TEXT NOT NULL,
  "cpuCores" REAL,
  "ramBytes" REAL,
  "diskBytes" REAL
);
CREATE INDEX "NodeMonitoringSample_sampledAt_idx" ON "NodeMonitoringSample"("sampledAt");
CREATE INDEX "NodeMonitoringSample_nodeName_sampledAt_idx" ON "NodeMonitoringSample"("nodeName", "sampledAt");
