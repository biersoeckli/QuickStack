ALTER TABLE "Agent" ADD COLUMN "healthChechHttpGetPath" TEXT;
ALTER TABLE "Agent" ADD COLUMN "healthCheckHttpScheme" TEXT;
ALTER TABLE "Agent" ADD COLUMN "healthCheckHttpHeadersJson" TEXT;
ALTER TABLE "Agent" ADD COLUMN "healthCheckHttpPort" INTEGER;
ALTER TABLE "Agent" ADD COLUMN "healthCheckPeriodSeconds" INTEGER NOT NULL DEFAULT 15;
ALTER TABLE "Agent" ADD COLUMN "healthCheckTimeoutSeconds" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "Agent" ADD COLUMN "healthCheckFailureThreshold" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "Agent" ADD COLUMN "healthCheckTcpPort" INTEGER;
