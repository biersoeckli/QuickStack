/*
  Warnings:

  - Made the column `image` on table `Agent` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Agent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "llmGatewayId" TEXT NOT NULL,
    "modelAlias" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "cpuRequest" INTEGER,
    "cpuLimit" INTEGER,
    "memoryRequest" INTEGER,
    "memoryLimit" INTEGER,
    "systemPrompt" TEXT,
    "encryptedEnvVars" TEXT,
    "containerCommand" TEXT,
    "containerArgs" TEXT,
    "warmPoolReplicas" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Agent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Agent_llmGatewayId_fkey" FOREIGN KEY ("llmGatewayId") REFERENCES "LlmGateway" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Agent" ("containerArgs", "containerCommand", "cpuLimit", "cpuRequest", "createdAt", "encryptedEnvVars", "id", "image", "llmGatewayId", "memoryLimit", "memoryRequest", "modelAlias", "name", "projectId", "systemPrompt", "updatedAt", "warmPoolReplicas") SELECT "containerArgs", "containerCommand", "cpuLimit", "cpuRequest", "createdAt", "encryptedEnvVars", "id", "image", "llmGatewayId", "memoryLimit", "memoryRequest", "modelAlias", "name", "projectId", "systemPrompt", "updatedAt", "warmPoolReplicas" FROM "Agent";
DROP TABLE "Agent";
ALTER TABLE "new_Agent" RENAME TO "Agent";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
