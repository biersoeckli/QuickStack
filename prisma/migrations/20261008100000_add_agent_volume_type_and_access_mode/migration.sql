-- AlterTable
ALTER TABLE "AgentVolume" ADD COLUMN "volumeType" TEXT NOT NULL DEFAULT 'ALL';
ALTER TABLE "AgentVolume" ADD COLUMN "accessMode" TEXT NOT NULL DEFAULT 'ReadWriteMany';
