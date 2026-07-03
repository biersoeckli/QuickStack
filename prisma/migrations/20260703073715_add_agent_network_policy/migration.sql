-- CreateTable
CREATE TABLE "AgentNetworkPolicy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "allowInternetAccess" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AgentNetworkPolicy_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AgentNetworkPolicyEgressRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentNetworkPolicyId" TEXT NOT NULL,
    "targetAppId" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "protocol" TEXT NOT NULL DEFAULT 'TCP',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AgentNetworkPolicyEgressRule_agentNetworkPolicyId_fkey" FOREIGN KEY ("agentNetworkPolicyId") REFERENCES "AgentNetworkPolicy" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AgentNetworkPolicyEgressRule_targetAppId_fkey" FOREIGN KEY ("targetAppId") REFERENCES "App" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentNetworkPolicy_agentId_key" ON "AgentNetworkPolicy"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentNetworkPolicyEgressRule_agentNetworkPolicyId_targetAppId_port_protocol_key" ON "AgentNetworkPolicyEgressRule"("agentNetworkPolicyId", "targetAppId", "port", "protocol");
