-- CreateTable
CREATE TABLE "AppNetworkPolicy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "appId" TEXT NOT NULL,
    "allowInternetAccess" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AppNetworkPolicy_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AppNetworkPolicyRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "appNetworkPolicyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "targetAppId" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "protocol" TEXT NOT NULL DEFAULT 'TCP',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AppNetworkPolicyRule_appNetworkPolicyId_fkey" FOREIGN KEY ("appNetworkPolicyId") REFERENCES "AppNetworkPolicy" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AppNetworkPolicyRule_targetAppId_fkey" FOREIGN KEY ("targetAppId") REFERENCES "App" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_App" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "appType" TEXT NOT NULL DEFAULT 'APP',
    "projectId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'GIT',
    "buildMethod" TEXT NOT NULL DEFAULT 'RAILPACK',
    "containerImageSource" TEXT,
    "containerRegistryUsername" TEXT,
    "containerRegistryPassword" TEXT,
    "containerCommand" TEXT,
    "containerArgs" TEXT,
    "securityContextRunAsUser" INTEGER,
    "securityContextRunAsGroup" INTEGER,
    "securityContextFsGroup" INTEGER,
    "securityContextPrivileged" BOOLEAN DEFAULT false,
    "gitUrl" TEXT,
    "gitBranch" TEXT,
    "gitUsername" TEXT,
    "gitToken" TEXT,
    "dockerfilePath" TEXT NOT NULL DEFAULT './Dockerfile',
    "replicas" INTEGER NOT NULL DEFAULT 1,
    "envVars" TEXT NOT NULL DEFAULT '',
    "memoryReservation" INTEGER,
    "memoryLimit" INTEGER,
    "cpuReservation" INTEGER,
    "cpuLimit" INTEGER,
    "webhookId" TEXT,
    "ingressNetworkPolicy" TEXT NOT NULL DEFAULT 'ALLOW_ALL',
    "egressNetworkPolicy" TEXT NOT NULL DEFAULT 'ALLOW_ALL',
    "useNetworkPolicy" BOOLEAN NOT NULL DEFAULT true,
    "networkPolicyMode" TEXT NOT NULL DEFAULT 'SIMPLE',
    "healthChechHttpGetPath" TEXT,
    "healthCheckHttpScheme" TEXT,
    "healthCheckHttpHeadersJson" TEXT,
    "healthCheckHttpPort" INTEGER,
    "healthCheckPeriodSeconds" INTEGER NOT NULL DEFAULT 15,
    "healthCheckTimeoutSeconds" INTEGER NOT NULL DEFAULT 5,
    "healthCheckFailureThreshold" INTEGER NOT NULL DEFAULT 3,
    "healthCheckTcpPort" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "App_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_App" ("appType", "buildMethod", "containerArgs", "containerCommand", "containerImageSource", "containerRegistryPassword", "containerRegistryUsername", "cpuLimit", "cpuReservation", "createdAt", "dockerfilePath", "egressNetworkPolicy", "envVars", "gitBranch", "gitToken", "gitUrl", "gitUsername", "healthChechHttpGetPath", "healthCheckFailureThreshold", "healthCheckHttpHeadersJson", "healthCheckHttpPort", "healthCheckHttpScheme", "healthCheckPeriodSeconds", "healthCheckTcpPort", "healthCheckTimeoutSeconds", "id", "ingressNetworkPolicy", "memoryLimit", "memoryReservation", "name", "projectId", "replicas", "securityContextFsGroup", "securityContextPrivileged", "securityContextRunAsGroup", "securityContextRunAsUser", "sourceType", "updatedAt", "useNetworkPolicy", "webhookId") SELECT "appType", "buildMethod", "containerArgs", "containerCommand", "containerImageSource", "containerRegistryPassword", "containerRegistryUsername", "cpuLimit", "cpuReservation", "createdAt", "dockerfilePath", "egressNetworkPolicy", "envVars", "gitBranch", "gitToken", "gitUrl", "gitUsername", "healthChechHttpGetPath", "healthCheckFailureThreshold", "healthCheckHttpHeadersJson", "healthCheckHttpPort", "healthCheckHttpScheme", "healthCheckPeriodSeconds", "healthCheckTcpPort", "healthCheckTimeoutSeconds", "id", "ingressNetworkPolicy", "memoryLimit", "memoryReservation", "name", "projectId", "replicas", "securityContextFsGroup", "securityContextPrivileged", "securityContextRunAsGroup", "securityContextRunAsUser", "sourceType", "updatedAt", "useNetworkPolicy", "webhookId" FROM "App";
DROP TABLE "App";
ALTER TABLE "new_App" RENAME TO "App";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "AppNetworkPolicy_appId_key" ON "AppNetworkPolicy"("appId");

-- CreateIndex
CREATE UNIQUE INDEX "AppNetworkPolicyRule_appNetworkPolicyId_targetAppId_port_protocol_type_key" ON "AppNetworkPolicyRule"("appNetworkPolicyId", "targetAppId", "port", "protocol", "type");
