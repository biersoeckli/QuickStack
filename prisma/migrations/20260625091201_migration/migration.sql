/*
  Warnings:

  - Added the required column `port` to the `AgentDomain` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AgentDomain" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hostname" TEXT NOT NULL,
    "useSsl" BOOLEAN NOT NULL DEFAULT true,
    "redirectHttps" BOOLEAN NOT NULL DEFAULT true,
    "port" INTEGER NOT NULL,
    "agentId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AgentDomain_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AgentDomain" ("agentId", "createdAt", "hostname", "id", "redirectHttps", "updatedAt", "useSsl") SELECT "agentId", "createdAt", "hostname", "id", "redirectHttps", "updatedAt", "useSsl" FROM "AgentDomain";
DROP TABLE "AgentDomain";
ALTER TABLE "new_AgentDomain" RENAME TO "AgentDomain";
CREATE UNIQUE INDEX "AgentDomain_hostname_key" ON "AgentDomain"("hostname");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
