-- CreateTable
CREATE TABLE "RoleAgentPermission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "roleProjectPermissionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RoleAgentPermission_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RoleAgentPermission_roleProjectPermissionId_fkey" FOREIGN KEY ("roleProjectPermissionId") REFERENCES "RoleProjectPermission" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "RoleAgentPermission_roleProjectPermissionId_agentId_key" ON "RoleAgentPermission"("roleProjectPermissionId", "agentId");
