// @vitest-environment node
vi.mock('@/server/adapter/kubernetes-api.adapter', () => ({ default: {} }));

import { createPrismaTestContext } from '@/__tests__/prisma-test.utils';
import nodeHistory from '@/server/services/standalone-services/node-monitoring-history.service';
import history from '@/server/services/standalone-services/app-monitoring-history.service';
import metrics from '@/server/services/standalone-services/app-history.service';
import filesystem from '@/server/services/standalone-services/app-volume-filesystem.service';

describe('App monitoring history persistence', () => {
  const ctx = createPrismaTestContext('app-monitoring-history');

  it('retains the boundary sample and removes history when its App is deleted', async () => {
    const db = ctx.getDataAccess().client;
    await db.project.create({ data: { id: 'project', name: 'Project' } });
    await db.app.create({ data: { id: 'app', name: 'App', projectId: 'project' } });
    const cutoff = new Date(Date.now() - 3600_000);
    await history.save(
      [
        { appId: 'app', sampledAt: new Date(cutoff.getTime() - 1), cpuCores: 1, ramBytes: 2 },
        { appId: 'app', sampledAt: cutoff, cpuCores: 3, ramBytes: 4 }
      ],
      [],
      [],
      cutoff
    );
    expect((await history.getHistory(['app'])).points.filter((point) => !point.isGap)).toMatchObject([{ cpuCores: 3, ramBytes: 4 }]);
    await db.app.delete({ where: { id: 'app' } });
    expect((await history.getHistory(['app'])).points).toEqual([]);
  });

  it('applies a reduced retention period to existing history', async () => {
    const db = ctx.getDataAccess().client;
    await db.project.create({ data: { id: 'project', name: 'Project' } });
    await db.app.create({ data: { id: 'app', name: 'App', projectId: 'project' } });
    const now = Date.now();
    await history.save([{ appId: 'app', sampledAt: new Date(now - 2 * 3600_000), cpuCores: 1, ramBytes: 2 }], [], [], new Date(now - 24 * 3600_000));
    await history.setRetentionHours(1);
    expect((await history.getHistory(['app'])).points).toEqual([]);
    await history.save([], [], [], new Date(now - (await history.getRetentionHours()) * 3600_000));
    expect(await db.monitoringSample.count()).toBe(0);
  });

  it('stores shared Volume usage once and exposes it only through accessible mounts', async () => {
    const db = ctx.getDataAccess().client;
    await db.project.create({ data: { id: 'project', name: 'Project' } });
    await db.app.createMany({
      data: [
        { id: 'one', name: 'One', projectId: 'project' },
        { id: 'two', name: 'Two', projectId: 'project' }
      ]
    });
    await db.appVolume.create({ data: { id: 'base', appId: 'one', containerMountPath: '/data', size: 1 } });
    await db.appVolume.create({ data: { id: 'shared', appId: 'two', containerMountPath: '/share', size: 1, sharedVolumeId: 'base' } });
    const sampledAt = new Date();
    await history.save(
      [],
      [{ id: 'sample', volumeId: 'base', sampledAt, status: 'available', usedBytes: 42, measuredAt: sampledAt }],
      [
        { sampleId: 'sample', volumeId: 'base' },
        { sampleId: 'sample', volumeId: 'shared' }
      ],
      new Date(sampledAt.getTime() - 3600_000)
    );
    expect(await db.appVolumeMonitoringSample.count()).toBe(1);
    expect((await history.getHistory(['two'])).volumes.map((volume) => volume.label)).toEqual(['/share']);
    expect((await history.getHistory(['one', 'two'])).points[0]).toMatchObject({ storageBytes: 42, availableVolumes: 1 });
    await db.appVolume.delete({ where: { id: 'base' } });
    expect((await history.getHistory(['one', 'two'])).points).toEqual([]);
  });

  it('collects shared Volume measurements and reads them through each App', async () => {
    const db = ctx.getDataAccess().client;
    await db.project.create({ data: { id: 'project', name: 'Project' } });
    await db.app.createMany({
      data: [
        { id: 'one', name: 'One', projectId: 'project' },
        { id: 'two', name: 'Two', projectId: 'project' }
      ]
    });
    await db.appVolume.create({ data: { id: 'base', appId: 'one', containerMountPath: '/data', size: 1 } });
    await db.appVolume.create({ data: { id: 'shared', appId: 'two', containerMountPath: '/share', size: 1, sharedVolumeId: 'base' } });
    const measuredAt = new Date();
    const appMetrics = vi.spyOn(metrics, 'getAppMetrics').mockResolvedValue(
      new Map([
        ['one', { cpuCores: 1, ramBytes: 100, measuredAt }],
        ['two', { cpuCores: 2, ramBytes: 200, measuredAt }]
      ])
    );
    const volumeMetrics = vi.spyOn(filesystem, 'getVolumeFilesystemUsage').mockResolvedValue(
      new Map([
        ['base', { pvcName: 'pvc-base', status: 'available', usedBytes: 42, measuredAt: measuredAt.toISOString() }],
        ['shared', { pvcName: 'pvc-base', status: 'available', usedBytes: 42, measuredAt: measuredAt.toISOString() }]
      ])
    );
    try {
      await history.collect();
      expect(await db.appVolumeMonitoringSample.count()).toBe(1);
      expect((await history.getHistory(['one', 'two'])).points[0]).toMatchObject({ cpuCores: 3, ramBytes: 300, storageBytes: 42, availableVolumes: 1 });
      expect((await history.getHistory(['two'])).volumes.map((volume) => volume.label)).toEqual(['/share']);
    } finally {
      appMetrics.mockRestore();
      volumeMetrics.mockRestore();
    }
  });

  it('keeps App and Node histories separate in the shared table', async () => {
    const db = ctx.getDataAccess().client;
    await db.project.create({ data: { id: 'project', name: 'Project' } });
    await db.app.create({ data: { id: 'app', name: 'App', projectId: 'project' } });
    const sampledAt = new Date();
    const cutoff = new Date(sampledAt.getTime() - 3600_000);
    await history.save([{ appId: 'app', sampledAt, cpuCores: 1, ramBytes: 2 }], [], [], cutoff);
    await nodeHistory.save([{ nodeName: 'node', sampledAt, measuredAt: sampledAt, cpuCores: 3, ramBytes: 4, nodeFilesystemUsedBytes: 5 }], cutoff);
    expect((await history.getRawHistory(['app'], cutoff))[0]).toHaveLength(1);
    expect(await db.monitoringSample.findMany({ where: { nodeName: { not: null }, sampledAt: { gte: cutoff } } })).toMatchObject([
      { nodeName: 'node', measuredAt: sampledAt, nodeFilesystemUsedBytes: 5 }
    ]);
    await db.app.delete({ where: { id: 'app' } });
    expect(await db.monitoringSample.findMany({ where: { nodeName: { not: null }, sampledAt: { gte: cutoff } } })).toHaveLength(1);
    await nodeHistory.save([], new Date(sampledAt.getTime() + 1));
    expect(await db.monitoringSample.findMany({ where: { nodeName: { not: null }, sampledAt: { gte: cutoff } } })).toHaveLength(0);
  });

  it('reads a day of five-minute history for 100 Apps', async () => {
    const db = ctx.getDataAccess().client;
    await db.project.create({ data: { id: 'project', name: 'Project' } });
    const appIds = Array.from({ length: 100 }, (_, index) => `app-${index}`);
    await db.app.createMany({ data: appIds.map((id) => ({ id, name: id, projectId: 'project' })) });
    const now = Date.now();
    const samples = Array.from({ length: 288 }, (_, index) =>
      appIds.map((appId) => ({ appId, sampledAt: new Date(now - index * 5 * 60_000), cpuCores: 0.25, ramBytes: 1024 }))
    ).flat();
    await history.save(samples, [], [], new Date(now - 24 * 3600_000));
    const result = await history.getHistory(appIds);
    expect(result.points).toHaveLength(288);
    expect(result.points[0]).toMatchObject({ cpuCores: 25, ramBytes: 102400 });
  }, 30000);
});
