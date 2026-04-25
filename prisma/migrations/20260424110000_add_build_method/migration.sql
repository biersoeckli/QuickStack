-- Add buildMethod for Git-based builds. Existing Git apps keep Dockerfile behavior.
ALTER TABLE "App" ADD COLUMN "buildMethod" TEXT NOT NULL DEFAULT 'RAILPACK';

UPDATE "App"
SET "buildMethod" = 'DOCKERFILE'
WHERE "sourceType" = 'GIT';
