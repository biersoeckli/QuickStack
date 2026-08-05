// @vitest-environment node

import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Project Type persistence', () => {
    it('migrates existing Projects to App Projects', () => {
        const db = new Database(':memory:');
        db.exec(`
            CREATE TABLE "Project" (
                "id" TEXT NOT NULL PRIMARY KEY,
                "name" TEXT NOT NULL,
                "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" DATETIME NOT NULL
            );
            INSERT INTO "Project" ("id", "name", "updatedAt")
            VALUES ('proj-existing', 'Existing Project', CURRENT_TIMESTAMP);
        `);

        const migration = readFileSync(
            resolve('prisma/migrations/20260622114500_add_project_type/migration.sql'),
            'utf8',
        );
        db.exec(migration);

        const project = db.prepare(
            'SELECT "projectType" FROM "Project" WHERE "id" = ?',
        ).get('proj-existing') as { projectType: string };

        expect(project.projectType).toBe('APP');
        db.close();
    });
});
