-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Agent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "llmGatewayId" TEXT NOT NULL,
    "modelAlias" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'CONTAINER',
    "buildMethod" TEXT NOT NULL DEFAULT 'DOCKERFILE',
    "containerImageSource" TEXT,
    "containerRegistryUsername" TEXT,
    "containerRegistryPassword" TEXT,
    "gitUrl" TEXT,
    "gitBranch" TEXT,
    "gitUsername" TEXT,
    "gitToken" TEXT,
    "dockerfilePath" TEXT NOT NULL DEFAULT './Dockerfile',
    "cpuRequest" INTEGER,
    "cpuLimit" INTEGER,
    "memoryRequest" INTEGER,
    "memoryLimit" INTEGER,
    "encryptedEnvVars" TEXT,
    "containerCommand" TEXT,
    "containerArgs" TEXT,
    "workingDir" TEXT,
    "runtimeClassName" TEXT,
    "warmPoolReplicas" INTEGER NOT NULL DEFAULT 0,
    "deployFileBrowser" BOOLEAN NOT NULL DEFAULT false,
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
    CONSTRAINT "Agent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Agent_llmGatewayId_fkey" FOREIGN KEY ("llmGatewayId") REFERENCES "LlmGateway" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Agent" ("buildMethod", "containerArgs", "containerCommand", "containerImageSource", "containerRegistryPassword", "containerRegistryUsername", "cpuLimit", "cpuRequest", "createdAt", "deployFileBrowser", "dockerfilePath", "encryptedEnvVars", "gitBranch", "gitToken", "gitUrl", "gitUsername", "healthChechHttpGetPath", "healthCheckFailureThreshold", "healthCheckHttpHeadersJson", "healthCheckHttpPort", "healthCheckHttpScheme", "healthCheckPeriodSeconds", "healthCheckTcpPort", "healthCheckTimeoutSeconds", "id", "llmGatewayId", "memoryLimit", "memoryRequest", "modelAlias", "name", "projectId", "runtimeClassName", "sourceType", "updatedAt", "warmPoolReplicas", "workingDir") SELECT "buildMethod", "containerArgs", "containerCommand", "containerImageSource", "containerRegistryPassword", "containerRegistryUsername", "cpuLimit", "cpuRequest", "createdAt", "deployFileBrowser", "dockerfilePath", "encryptedEnvVars", "gitBranch", "gitToken", "gitUrl", "gitUsername", "healthChechHttpGetPath", "healthCheckFailureThreshold", "healthCheckHttpHeadersJson", "healthCheckHttpPort", "healthCheckHttpScheme", "healthCheckPeriodSeconds", "healthCheckTcpPort", "healthCheckTimeoutSeconds", "id", "llmGatewayId", "memoryLimit", "memoryRequest", "modelAlias", "name", "projectId", "runtimeClassName", "sourceType", "updatedAt", "warmPoolReplicas", "workingDir" FROM "Agent";
DROP TABLE "Agent";
ALTER TABLE "new_Agent" RENAME TO "Agent";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
