-- AlterTable
ALTER TABLE "App" ADD COLUMN "framework" TEXT;
ALTER TABLE "App" ADD COLUMN "installCommand" TEXT;
ALTER TABLE "App" ADD COLUMN "buildCommand" TEXT;
ALTER TABLE "App" ADD COLUMN "runCommand" TEXT;
ALTER TABLE "App" ADD COLUMN "rootDirectory" TEXT DEFAULT './';
ALTER TABLE "App" ADD COLUMN "outputDirectory" TEXT;
ALTER TABLE "App" ADD COLUMN "nodeVersion" TEXT;
