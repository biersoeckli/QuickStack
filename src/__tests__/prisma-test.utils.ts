import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { beforeAll, beforeEach, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import dataAccess from '@/server/adapter/db.client';

/**
 * Creates an isolated Prisma/SQLite test context for integration tests.
 *
 * Automatically registers beforeAll, beforeEach, and afterAll in the calling
 * describe scope — no manual hook wiring needed.
 *
 * Works by mutating dataAccess.client on the singleton directly. Services that
 * use dataAccess internally automatically use the test DB — no vi.resetModules()
 * or dynamic imports required. Services can be statically imported at the top
 * of the test file.
 *
 * Usage:
 *   import myService from '@/server/services/my.service'; // static import is fine
 *
 *   describe('my suite', () => {
 *       const ctx = createPrismaTestContext('my-service');
 *
 *       it('service uses test DB', async () => {
 *           await myService.create(...);
 *           const { client } = ctx.getDataAccess();
 *           expect(await client.app.count()).toBe(1);
 *       });
 *   });
 */
export function createPrismaTestContext(label: string) {
    const dbFile = path.join(os.tmpdir(), `quickstack-${label}-${Date.now()}.db`);
    let testClient: PrismaClient;

    beforeAll(async () => {
        process.env.DATABASE_URL = `file:${dbFile}`;
        execSync('npx prisma db push', { stdio: 'pipe', env: { ...process.env } });
        const adapter = new PrismaBetterSqlite3({ url: `file:${dbFile}` });
        testClient = new PrismaClient({ adapter });
        // Mutate the singleton's client — all services using dataAccess.client
        // now transparently point to the isolated test database.
        (dataAccess as any).client = testClient;
    });

    /**
     * Deletes all rows in FK-safe order so each test starts from a clean state.
     * Self-referential AppVolume.sharedVolumeId is nulled before deletion.
     */
    beforeEach(async () => {
        await dataAccess.client.volumeBackup.deleteMany();
        await dataAccess.client.appBasicAuth.deleteMany();
        await dataAccess.client.appFileMount.deleteMany();
        await dataAccess.client.appDomain.deleteMany();
        await dataAccess.client.appPort.deleteMany();
        await dataAccess.client.roleAppPermission.deleteMany();
        await dataAccess.client.roleProjectPermission.deleteMany();
        // AppVolume has a self-referential relation; clear the FK first
        await dataAccess.client.appVolume.updateMany({ data: { sharedVolumeId: null } });
        await dataAccess.client.appVolume.deleteMany();
        await dataAccess.client.app.deleteMany();
        await dataAccess.client.project.deleteMany();
        await dataAccess.client.s3Target.deleteMany();
        await dataAccess.client.authenticator.deleteMany();
        await dataAccess.client.session.deleteMany();
        await dataAccess.client.account.deleteMany();
        await dataAccess.client.verificationToken.deleteMany();
        await dataAccess.client.user.deleteMany();
        await dataAccess.client.userGroup.deleteMany();
        await dataAccess.client.parameter.deleteMany();
    });

    afterAll(async () => {
        await testClient.$disconnect();
        await fs.rm(dbFile, { force: true });
    });

    function getDataAccess() {
        return dataAccess;
    }

    return { getDataAccess, dbFile };
}
