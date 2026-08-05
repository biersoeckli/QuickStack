/*
  Warnings:

  - You are about to drop the `AgentNetworkPolicyEgressRule` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "AgentNetworkPolicyEgressRule";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "AgentNetworkPolicyRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentNetworkPolicyId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'EGRESS',
    "targetAppId" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "protocol" TEXT NOT NULL DEFAULT 'TCP',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AgentNetworkPolicyRule_agentNetworkPolicyId_fkey" FOREIGN KEY ("agentNetworkPolicyId") REFERENCES "AgentNetworkPolicy" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AgentNetworkPolicyRule_targetAppId_fkey" FOREIGN KEY ("targetAppId") REFERENCES "App" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentNetworkPolicyRule_agentNetworkPolicyId_targetAppId_port_protocol_type_key" ON "AgentNetworkPolicyRule"("agentNetworkPolicyId", "targetAppId", "port", "protocol", "type");
