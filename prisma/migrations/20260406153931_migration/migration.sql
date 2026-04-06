-- CreateTable
CREATE TABLE "AppNodePort" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "appId" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "nodePort" INTEGER NOT NULL,
    "protocol" TEXT NOT NULL DEFAULT 'TCP',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AppNodePort_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AppNodePort_nodePort_key" ON "AppNodePort"("nodePort");
