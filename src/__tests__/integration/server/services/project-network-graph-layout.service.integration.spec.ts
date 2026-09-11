// @vitest-environment node
import mockNextJsCaching from '@/__tests__/nextjs-cache.utils';
mockNextJsCaching();

import { createPrismaTestContext } from '@/__tests__/prisma-test.utils';
import projectNetworkGraphLayoutService from '@/server/services/project-network-graph-layout.service';

describe('project network graph layout service integration', () => {
    const dbCtx = createPrismaTestContext('project-network-graph-layout');

    async function createProjectWithApps() {
        const db = dbCtx.getDataAccess().client;
        await db.project.create({ data: { id: 'project-a', name: 'Project A' } });
        await db.app.create({ data: { id: 'app-a', name: 'App A', projectId: 'project-a' } });
        await db.app.create({ data: { id: 'app-b', name: 'App B', projectId: 'project-a' } });
    }

    it('creates and updates one position without replacing other nodes', async () => {
        await createProjectWithApps();

        await projectNetworkGraphLayoutService.savePosition('project-a', { nodeId: 'APP:app-a', x: 10, y: 20 });
        await projectNetworkGraphLayoutService.savePosition('project-a', { nodeId: 'APP:app-b', x: 30, y: 40 });
        await projectNetworkGraphLayoutService.savePosition('project-a', { nodeId: 'APP:app-a', x: 50, y: 60 });

        await expect(projectNetworkGraphLayoutService.getPositions('project-a')).resolves.toEqual({
            'APP:app-a': { x: 50, y: 60 },
            'APP:app-b': { x: 30, y: 40 },
        });
    });

    it('rejects nodes outside the project graph', async () => {
        await createProjectWithApps();
        await dbCtx.getDataAccess().client.project.create({ data: { id: 'project-b', name: 'Project B' } });
        await dbCtx.getDataAccess().client.app.create({ data: { id: 'foreign-app', name: 'Foreign', projectId: 'project-b' } });

        await expect(projectNetworkGraphLayoutService.savePosition(
            'project-a',
            { nodeId: 'APP:foreign-app', x: 1, y: 2 },
        )).rejects.toThrow('Network graph node does not belong to this project.');
    });

    it('rejects non-finite coordinates at the service boundary', async () => {
        await createProjectWithApps();

        await expect(projectNetworkGraphLayoutService.savePosition(
            'project-a',
            { nodeId: 'APP:app-a', x: Number.NaN, y: 2 },
        )).rejects.toThrow('Invalid network graph position.');
    });

    it('resets positions and cascades them when the project is deleted', async () => {
        await createProjectWithApps();
        const db = dbCtx.getDataAccess().client;
        await db.appDomain.create({
            data: { appId: 'app-a', hostname: 'app.example.test', port: 3000 },
        });
        await projectNetworkGraphLayoutService.savePosition('project-a', { nodeId: 'INTERNET', x: 1, y: 2 });

        await projectNetworkGraphLayoutService.resetPositions('project-a');
        expect(await db.projectNetworkGraphPosition.count()).toBe(0);

        await projectNetworkGraphLayoutService.savePosition('project-a', { nodeId: 'APP:app-a', x: 3, y: 4 });
        await db.project.delete({ where: { id: 'project-a' } });
        expect(await db.projectNetworkGraphPosition.count()).toBe(0);
    });
});
