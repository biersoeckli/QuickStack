vi.mock('./node-resource.service', () => ({ default: { getNodeResourceUsage: vi.fn() } }));
vi.mock('@/server/adapter/db.client', () => ({ default: { client: { monitoringSample: { findMany: vi.fn() } } } }));
vi.mock('./monitoring-history.service', () => ({ default: { getRetentionHours: vi.fn() } }));
import history from './node-monitoring-history.service';
import resources from './node-resource.service';
import dataAccess from '@/server/adapter/db.client';
import monitoringHistory from './monitoring-history.service';

const save = vi.spyOn(history, 'save').mockResolvedValue(undefined);

it('stores every node and applies the shared retention period', async () => {
  const measuredAt = new Date('2026-11-16T11:59:00Z');
  vi.mocked(resources.getNodeResourceUsage).mockResolvedValue([
    { name: 'a', measuredAt, cpuUsage: 1, ramUsage: 20, cpuCapacity: 2, ramCapacity: 40, diskUsageAbsolut: 30 },
    { name: 'b', cpuUsage: null, ramUsage: 10, cpuCapacity: 2, ramCapacity: 40 }
  ]);
  const time = new Date('2026-11-16T12:00:00Z');
  await history.collect(time, 24);
  expect(save).toHaveBeenCalledWith(
    [
      { sampledAt: time, nodeName: 'a', cpuCores: 1, ramBytes: 20, nodeFilesystemUsedBytes: 30, measuredAt },
      { sampledAt: time, nodeName: 'b', cpuCores: null, ramBytes: 10, nodeFilesystemUsedBytes: null, measuredAt: null }
    ],
    new Date('2026-11-15T12:00:00Z')
  );
});

it('returns sums and gaps from the retained samples', async () => {
  vi.mocked(monitoringHistory.getRetentionHours).mockResolvedValue(24);
  const time = new Date();
  vi.mocked(dataAccess.client.monitoringSample.findMany).mockResolvedValue([
    { id: '1', nodeName: 'a', appId: null, sampledAt: time, cpuCores: 1, ramBytes: 10, nodeFilesystemUsedBytes: 100, measuredAt: time },
    { id: '2', nodeName: 'b', appId: null, sampledAt: time, cpuCores: 2, ramBytes: null, nodeFilesystemUsedBytes: 200, measuredAt: time }
  ]);
  expect(await history.getHistory()).toEqual({ retentionHours: 24, points: [{ time: time.getTime(), cpuCores: 3, ramBytes: 10, diskBytes: 300 }] });
});
