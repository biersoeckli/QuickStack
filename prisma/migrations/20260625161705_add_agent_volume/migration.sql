-- CreateTable
CREATE TABLE "AgentVolume" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "containerMountPath" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "accessMode" TEXT NOT NULL DEFAULT 'rwo',
    "storageClassName" TEXT NOT NULL DEFAULT 'longhorn',
    "agentId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AgentVolume_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentVolume_agentId_containerMountPath_key" ON "AgentVolume"("agentId", "containerMountPath");
