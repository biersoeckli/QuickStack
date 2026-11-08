vi.mock('@/server/adapter/app-history.adapter', () => ({
    default: { getRetentionHours: vi.fn().mockResolvedValue(24), getHistory: vi.fn() },
}));
import adapter from '@/server/adapter/app-history.adapter';
import historyService from './app-monitoring-history-query.service';

it('shows incomplete App totals as gaps and counts shared volumes once', async () => {
    const now = new Date();
    const app = (appId: string, cpuCores: number | null) => ({ id: appId, appId, sampledAt: now, cpuCores, ramBytes: cpuCores === null ? null : 100, measuredAt: now });
    const volume = (id: string, sharedVolumeId: string | null, status: string, usedBytes: number | null) => ({ id, volumeId: id, sampledAt: now, status, usedBytes, availableBytes: null, capacityBytes: null, measuredAt: now, volume: { appId: id, sharedVolumeId, containerMountPath: '/data', app: { projectId: 'project' } } });
    vi.mocked(adapter.getHistory).mockResolvedValue([
        [app('one', 1), app('two', null)],
        [volume('base', null, 'available', 20), volume('shared', 'base', 'available', 20), volume('missing', null, 'unavailable', null)],
    ]);
    const history = await historyService.getHistory(['one', 'two']);
    expect(history.points[0]).toMatchObject({ cpuCores: null, ramBytes: null, storageBytes: 20, availableVolumes: 1, unavailableVolumes: 1 });
});

it('inserts a gap across collection downtime', async () => {
    const time = Date.now();
    const sample = (offset: number) => ({ id: String(offset), appId: 'app', sampledAt: new Date(time + offset), cpuCores: 1, ramBytes: 100, measuredAt: new Date(time + offset) });
    vi.mocked(adapter.getHistory).mockResolvedValue([[sample(0), sample(15 * 60_000)], []]);
    const result = await historyService.getHistory(['app']);
    expect(result.points.map(point => point.cpuCores)).toEqual([1, null, 1]);
});

it('shows a trailing gap while collection remains stopped', async () => {
    const now = Date.now();
    const sampledAt = new Date(now - 30 * 60_000);
    vi.mocked(adapter.getHistory).mockResolvedValue([[{
        id: 'one', appId: 'app', sampledAt, cpuCores: 1, ramBytes: 100, measuredAt: sampledAt,
    }], [{
        id: 'volume-sample', volumeId: 'volume', sampledAt, status: 'available', usedBytes: 42,
        availableBytes: 58, capacityBytes: 100, measuredAt: sampledAt,
        volume: { appId: 'app', sharedVolumeId: null, containerMountPath: '/data', app: { projectId: 'project' } },
    }]]);
    const result = await historyService.getHistory(['app']);
    expect(result.points.at(-1)).toMatchObject({ time: expect.any(Number), cpuCores: null, ramBytes: null, storageBytes: null, isGap: true });
    expect(result.points.at(-1)!.time).toBeGreaterThanOrEqual(now);
    expect(result.volumes[0].points.at(-1)).toMatchObject({ usedBytes: null });
});
