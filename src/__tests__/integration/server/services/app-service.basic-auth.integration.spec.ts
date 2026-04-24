// @vitest-environment node

import mockNextJsCaching from '@/__tests__/nextjs-cache.utils';
mockNextJsCaching();

vi.mock('@/server/adapter/kubernetes-api.adapter', () => ({ default: {} }));
vi.mock('@/server/services/deployment.service', () => ({ default: {} }));
vi.mock('@/server/services/build.service', () => ({ default: {} }));
vi.mock('@/server/services/ingress.service', () => ({ default: {} }));
vi.mock('@/server/services/pvc.service', () => ({ default: {} }));
vi.mock('@/server/services/svc.service', () => ({ default: {} }));
vi.mock('@/server/services/deployment-logs.service', () => ({ default: {}, dlog: vi.fn() }));
vi.mock('@/server/services/network-policy.service', () => ({ default: {} }));

import { createPrismaTestContext } from '@/__tests__/prisma-test.utils';
import appService from '@/server/services/app.service';

describe('app.service – BasicAuth CRUD', () => {
    const ctx = createPrismaTestContext('app-service-basic-auth');

    async function createProjectAndApp() {
        const project = await ctx.getDataAccess().client.project.create({
            data: { name: 'test-project' },
        });
        const app = await ctx.getDataAccess().client.app.create({
            data: { id: 'app-test-id', name: 'test-app', projectId: project.id },
        });
        return { project, app };
    }

    describe('saveBasicAuth', () => {
        it('creates a new basicAuth entry', async () => {
            const { app } = await createProjectAndApp();

            const result = await appService.saveBasicAuth({
                appId: app.id,
                username: 'alice',
                password: 'secret123',
            });

            expect(result.id).toBeDefined();
            expect(result.username).toBe('alice');
            expect(result.password).toBe('secret123');
            expect(result.appId).toBe(app.id);
        });

        it('updates an existing basicAuth entry', async () => {
            const { app } = await createProjectAndApp();

            const created = await appService.saveBasicAuth({
                appId: app.id,
                username: 'alice',
                password: 'secret123',
            });

            const updated = await appService.saveBasicAuth({
                id: created.id,
                appId: app.id,
                username: 'alice-updated',
                password: 'newpass456',
            });

            expect(updated.id).toBe(created.id);
            expect(updated.username).toBe('alice-updated');
            expect(updated.password).toBe('newpass456');
        });

        it('persists created basicAuth to the database', async () => {
            const { app } = await createProjectAndApp();

            await appService.saveBasicAuth({
                appId: app.id,
                username: 'bob',
                password: 'bobpass',
            });

            const rows = await ctx.getDataAccess().client.appBasicAuth.findMany();
            expect(rows).toHaveLength(1);
            expect(rows[0].username).toBe('bob');
        });

        it('allows multiple basicAuth entries per app', async () => {
            const { app } = await createProjectAndApp();

            await appService.saveBasicAuth({ appId: app.id, username: 'user1', password: 'pass1' });
            await appService.saveBasicAuth({ appId: app.id, username: 'user2', password: 'pass2' });

            const rows = await ctx.getDataAccess().client.appBasicAuth.findMany();
            expect(rows).toHaveLength(2);
        });
    });

    describe('getBasicAuthById', () => {
        it('returns the basicAuth entry by id', async () => {
            const { app } = await createProjectAndApp();

            const created = await appService.saveBasicAuth({
                appId: app.id,
                username: 'charlie',
                password: 'charliepass',
            });

            const fetched = await appService.getBasicAuthById(created.id);

            expect(fetched.id).toBe(created.id);
            expect(fetched.username).toBe('charlie');
        });

        it('throws when id does not exist', async () => {
            await expect(
                appService.getBasicAuthById('non-existent-id')
            ).rejects.toThrow();
        });
    });

    describe('deleteBasicAuthById', () => {
        it('removes the basicAuth entry from the database', async () => {
            const { app } = await createProjectAndApp();

            const created = await appService.saveBasicAuth({
                appId: app.id,
                username: 'dave',
                password: 'davepass',
            });

            await appService.deleteBasicAuthById(created.id);

            const rows = await ctx.getDataAccess().client.appBasicAuth.findMany();
            expect(rows).toHaveLength(0);
        });

        it('does nothing when id does not exist', async () => {
            await expect(
                appService.deleteBasicAuthById('non-existent-id')
            ).resolves.not.toThrow();
        });

        it('only deletes the targeted entry, leaving others intact', async () => {
            const { app } = await createProjectAndApp();

            const first = await appService.saveBasicAuth({ appId: app.id, username: 'eve', password: 'evepass' });
            await appService.saveBasicAuth({ appId: app.id, username: 'frank', password: 'frankpass' });

            await appService.deleteBasicAuthById(first.id);

            const rows = await ctx.getDataAccess().client.appBasicAuth.findMany();
            expect(rows).toHaveLength(1);
            expect(rows[0].username).toBe('frank');
        });
    });
});
