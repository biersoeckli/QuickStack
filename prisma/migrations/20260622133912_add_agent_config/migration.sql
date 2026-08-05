-- AlterTable
ALTER TABLE "Agent" ADD COLUMN "cpuLimit" TEXT;
ALTER TABLE "Agent" ADD COLUMN "cpuRequest" TEXT;
ALTER TABLE "Agent" ADD COLUMN "encryptedEnvVars" TEXT;
ALTER TABLE "Agent" ADD COLUMN "image" TEXT;
ALTER TABLE "Agent" ADD COLUMN "memoryLimit" TEXT;
ALTER TABLE "Agent" ADD COLUMN "memoryRequest" TEXT;
ALTER TABLE "Agent" ADD COLUMN "systemPrompt" TEXT;
