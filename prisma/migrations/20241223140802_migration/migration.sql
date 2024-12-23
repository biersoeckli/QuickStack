-- CreateTable
CREATE TABLE "AppFileMount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "containerMountPath" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AppFileMount_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AppFileMount_appId_containerMountPath_key" ON "AppFileMount"("appId", "containerMountPath");
