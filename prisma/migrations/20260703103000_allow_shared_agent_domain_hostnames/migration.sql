/*
  Warnings:

  - The unique index on the column `hostname` for the table `AgentDomain` will be dropped.
  - A new composite unique index on `[agentId, hostname]` will be created.

*/
-- DropIndex
DROP INDEX "AgentDomain_hostname_key";

-- CreateIndex
CREATE UNIQUE INDEX "AgentDomain_agentId_hostname_key" ON "AgentDomain"("agentId", "hostname");
