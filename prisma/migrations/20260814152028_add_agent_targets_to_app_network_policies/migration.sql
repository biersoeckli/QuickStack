-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AppNetworkPolicyRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "appNetworkPolicyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "targetAppId" TEXT,
    "targetAgentId" TEXT,
    "port" INTEGER NOT NULL,
    "protocol" TEXT NOT NULL DEFAULT 'TCP',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AppNetworkPolicyRule_appNetworkPolicyId_fkey" FOREIGN KEY ("appNetworkPolicyId") REFERENCES "AppNetworkPolicy" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AppNetworkPolicyRule_targetAppId_fkey" FOREIGN KEY ("targetAppId") REFERENCES "App" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AppNetworkPolicyRule_targetAgentId_fkey" FOREIGN KEY ("targetAgentId") REFERENCES "Agent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AppNetworkPolicyRule" ("appNetworkPolicyId", "createdAt", "id", "port", "protocol", "targetAppId", "type", "updatedAt") SELECT "appNetworkPolicyId", "createdAt", "id", "port", "protocol", "targetAppId", "type", "updatedAt" FROM "AppNetworkPolicyRule";
DROP TABLE "AppNetworkPolicyRule";
ALTER TABLE "new_AppNetworkPolicyRule" RENAME TO "AppNetworkPolicyRule";
CREATE UNIQUE INDEX "AppNetworkPolicyRule_appNetworkPolicyId_targetAppId_port_protocol_type_key" ON "AppNetworkPolicyRule"("appNetworkPolicyId", "targetAppId", "port", "protocol", "type");
CREATE UNIQUE INDEX "AppNetworkPolicyRule_appNetworkPolicyId_targetAgentId_port_protocol_type_key" ON "AppNetworkPolicyRule"("appNetworkPolicyId", "targetAgentId", "port", "protocol", "type");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
