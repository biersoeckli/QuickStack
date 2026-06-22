/*
  Warnings:

  - You are about to alter the column `cpuLimit` on the `Agent` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.
  - You are about to alter the column `cpuRequest` on the `Agent` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.
  - You are about to alter the column `memoryLimit` on the `Agent` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.
  - You are about to alter the column `memoryRequest` on the `Agent` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.

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
    "image" TEXT,
    "cpuRequest" INTEGER,
    "cpuLimit" INTEGER,
    "memoryRequest" INTEGER,
    "memoryLimit" INTEGER,
    "systemPrompt" TEXT,
    "encryptedEnvVars" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Agent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Agent_llmGatewayId_fkey" FOREIGN KEY ("llmGatewayId") REFERENCES "LlmGateway" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Agent" ("cpuLimit", "cpuRequest", "createdAt", "encryptedEnvVars", "id", "image", "llmGatewayId", "memoryLimit", "memoryRequest", "modelAlias", "name", "projectId", "systemPrompt", "updatedAt") SELECT "cpuLimit", "cpuRequest", "createdAt", "encryptedEnvVars", "id", "image", "llmGatewayId", "memoryLimit", "memoryRequest", "modelAlias", "name", "projectId", "systemPrompt", "updatedAt" FROM "Agent";
DROP TABLE "Agent";
ALTER TABLE "new_Agent" RENAME TO "Agent";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
