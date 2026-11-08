// @vitest-environment node
import { createPrismaTestContext } from '@/__tests__/prisma-test.utils';
import adapter from '@/server/adapter/app-history.adapter';
import history from '@/server/services/app-monitoring-history-query.service';

describe('App monitoring history persistence', () => {
    const ctx = createPrismaTestContext('app-monitoring-history');

    it('retains the boundary sample and removes history when its App is deleted', async () => {
        const db = ctx.getDataAccess().client;
        await db.project.create({ data: { id: 'project', name: 'Project' } });
        await db.app.create({ data: { id: 'app', name: 'App', projectId: 'project' } });
        const cutoff = new Date(Date.now() - 3600_000);
        await adapter.save([
            { appId: 'app', sampledAt: new Date(cutoff.getTime() - 1), cpuCores: 1, ramBytes: 2 },
            { appId: 'app', sampledAt: cutoff, cpuCores: 3, ramBytes: 4 },
        ], [], [], cutoff);
        expect((await history.getHistory(['app'])).points).toMatchObject([{ cpuCores: 3, ramBytes: 4 }]);
        await db.app.delete({ where: { id: 'app' } });
        expect((await history.getHistory(['app'])).points).toEqual([]);
    });

    it('applies a reduced retention period to existing history', async () => {
        const db = ctx.getDataAccess().client;
        await db.project.create({ data: { id: 'project', name: 'Project' } });
        await db.app.create({ data: { id: 'app', name: 'App', projectId: 'project' } });
        const now = Date.now();
        await adapter.save([{ appId: 'app', sampledAt: new Date(now - 2 * 3600_000), cpuCores: 1, ramBytes: 2 }], [], [], new Date(now - 24 * 3600_000));
        await adapter.setRetentionHours(1);
        expect((await history.getHistory(['app'])).points).toEqual([]);
        await adapter.save([], [], [], new Date(now - (await adapter.getRetentionHours()) * 3600_000));
        expect(await db.appMonitoringSample.count()).toBe(0);
    });

    it('stores shared Volume usage once and exposes it only through accessible mounts', async () => {
        const db = ctx.getDataAccess().client;
        await db.project.create({ data: { id: 'project', name: 'Project' } });
        await db.app.createMany({ data: [
            { id: 'one', name: 'One', projectId: 'project' },
            { id: 'two', name: 'Two', projectId: 'project' },
        ] });
        await db.appVolume.create({ data: { id: 'base', appId: 'one', containerMountPath: '/data', size: 1 } });
        await db.appVolume.create({ data: { id: 'shared', appId: 'two', containerMountPath: '/share', size: 1, sharedVolumeId: 'base' } });
        const sampledAt = new Date();
        await adapter.save([], [{ id: 'sample', volumeId: 'base', sampledAt, status: 'available', usedBytes: 42, measuredAt: sampledAt }], [
            { sampleId: 'sample', volumeId: 'base' }, { sampleId: 'sample', volumeId: 'shared' },
        ], new Date(sampledAt.getTime() - 3600_000));
        expect(await db.appVolumeMonitoringSample.count()).toBe(1);
        expect((await history.getHistory(['two'])).volumes.map(volume => volume.label)).toEqual(['/share']);
        expect((await history.getHistory(['one', 'two'])).points[0]).toMatchObject({ storageBytes: 42, availableVolumes: 1 });
        await db.appVolume.delete({ where: { id: 'base' } });
        expect((await history.getHistory(['one', 'two'])).points).toEqual([]);
    });


    it('reads a day of five-minute history for 100 Apps', async () => {
        const db = ctx.getDataAccess().client;
        await db.project.create({ data: { id: 'project', name: 'Project' } });
        const appIds = Array.from({ length: 100 }, (_, index) => `app-${index}`);
        await db.app.createMany({ data: appIds.map(id => ({ id, name: id, projectId: 'project' })) });
        const now = Date.now();
        const samples = Array.from({ length: 288 }, (_, index) => appIds.map(appId => ({
            appId, sampledAt: new Date(now - index * 5 * 60_000), cpuCores: 0.25, ramBytes: 1024,
        }))).flat();
        await adapter.save(samples, [], [], new Date(now - 24 * 3600_000));
        const result = await history.getHistory(appIds);
        expect(result.points).toHaveLength(288);
        expect(result.points[0]).toMatchObject({ cpuCores: 25, ramBytes: 102400 });
    }, 30000);

});
