-- Add App-compatible source fields to Agents and migrate the old image field.
ALTER TABLE "Agent" ADD COLUMN "sourceType" TEXT NOT NULL DEFAULT 'CONTAINER';
ALTER TABLE "Agent" ADD COLUMN "buildMethod" TEXT NOT NULL DEFAULT 'DOCKERFILE';
ALTER TABLE "Agent" ADD COLUMN "containerImageSource" TEXT;
ALTER TABLE "Agent" ADD COLUMN "containerRegistryUsername" TEXT;
ALTER TABLE "Agent" ADD COLUMN "containerRegistryPassword" TEXT;
ALTER TABLE "Agent" ADD COLUMN "gitUrl" TEXT;
ALTER TABLE "Agent" ADD COLUMN "gitBranch" TEXT;
ALTER TABLE "Agent" ADD COLUMN "gitUsername" TEXT;
ALTER TABLE "Agent" ADD COLUMN "gitToken" TEXT;
ALTER TABLE "Agent" ADD COLUMN "dockerfilePath" TEXT NOT NULL DEFAULT './Dockerfile';

UPDATE "Agent"
SET "containerImageSource" = "image"
WHERE "image" IS NOT NULL;

ALTER TABLE "Agent" DROP COLUMN "image";

CREATE TABLE "AgentGitSshKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "encryptedPrivateKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AgentGitSshKey_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "AgentGitSshKey_agentId_key" ON "AgentGitSshKey"("agentId");
