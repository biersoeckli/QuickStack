/*
  Warnings:

  - You are about to drop the column `accessMode` on the `AgentVolume` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AgentVolume" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "containerMountPath" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storageClassName" TEXT NOT NULL DEFAULT 'longhorn',
    "agentId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AgentVolume_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AgentVolume" ("agentId", "containerMountPath", "createdAt", "id", "size", "storageClassName", "updatedAt") SELECT "agentId", "containerMountPath", "createdAt", "id", "size", "storageClassName", "updatedAt" FROM "AgentVolume";
DROP TABLE "AgentVolume";
ALTER TABLE "new_AgentVolume" RENAME TO "AgentVolume";
CREATE UNIQUE INDEX "AgentVolume_agentId_containerMountPath_key" ON "AgentVolume"("agentId", "containerMountPath");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
