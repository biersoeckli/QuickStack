ALTER TABLE "AppNetworkPolicy" ADD COLUMN "allowTraefikAccess" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AgentNetworkPolicy" ADD COLUMN "allowTraefikAccess" BOOLEAN NOT NULL DEFAULT false;
