-- AlterTable
ALTER TABLE "App" ADD COLUMN "securityContextFsGroup" INTEGER;
ALTER TABLE "App" ADD COLUMN "securityContextRunAsGroup" INTEGER;
ALTER TABLE "App" ADD COLUMN "securityContextRunAsUser" INTEGER;
