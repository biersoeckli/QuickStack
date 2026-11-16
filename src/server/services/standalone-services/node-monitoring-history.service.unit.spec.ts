vi.mock('./node-resource.service', () => ({ default: { getNodeResourceUsage: vi.fn() } }));
vi.mock('@/server/adapter/node-monitoring-history.adapter', () => ({ default: { save: vi.fn(), getHistory: vi.fn() } }));
vi.mock('@/server/adapter/app-history.adapter', () => ({ default: { getRetentionHours: vi.fn() } }));
import history from './node-monitoring-history.service';
import resources from './node-resource.service';
import adapter from '@/server/adapter/node-monitoring-history.adapter';
import appAdapter from '@/server/adapter/app-history.adapter';

it('stores every node and applies the shared retention period', async () => {
  vi.mocked(resources.getNodeResourceUsage).mockResolvedValue([
    { name: 'a', cpuUsage: 1, ramUsage: 20, cpuCapacity: 2, ramCapacity: 40, diskUsageAbsolut: 30 },
    { name: 'b', cpuUsage: null, ramUsage: 10, cpuCapacity: 2, ramCapacity: 40 }
  ]);
  const time = new Date('2026-11-16T12:00:00Z');
  await history.collect(time, 24);
  expect(adapter.save).toHaveBeenCalledWith(
    [
      { sampledAt: time, nodeName: 'a', cpuCores: 1, ramBytes: 20, diskBytes: 30 },
      { sampledAt: time, nodeName: 'b', cpuCores: null, ramBytes: 10, diskBytes: null }
    ],
    new Date('2026-11-15T12:00:00Z')
  );
});

it('returns sums and gaps from the retained samples', async () => {
  vi.mocked(appAdapter.getRetentionHours).mockResolvedValue(24);
  const time = new Date();
  vi.mocked(adapter.getHistory).mockResolvedValue([
    { id: '1', nodeName: 'a', sampledAt: time, cpuCores: 1, ramBytes: 10, diskBytes: 100 },
    { id: '2', nodeName: 'b', sampledAt: time, cpuCores: 2, ramBytes: null, diskBytes: 200 }
  ]);
  expect(await history.getHistory()).toEqual({ retentionHours: 24, points: [{ time: time.getTime(), cpuCores: 3, ramBytes: null, diskBytes: 300 }] });
});
