vi.mock('@/server/adapter/volume-summary.adapter', () => ({
    default: { getPersistentVolumeClaims: vi.fn(), getPersistentVolumes: vi.fn(), getSamples: vi.fn() },
}));

import adapter from '@/server/adapter/volume-summary.adapter';
import filesystem from './app-volume-filesystem.service';

it('associates shared mounts with their project observation and preserves missing and stale status', async () => {
    const now = Date.now();
    vi.mocked(adapter.getPersistentVolumeClaims).mockResolvedValue([
        { metadata: { namespace: 'one', name: 'pvc-base' }, spec: { volumeName: 'pv-one' } },
        { metadata: { namespace: 'two', name: 'pvc-base' }, spec: { volumeName: 'pv-two' } },
    ] as never);
    vi.mocked(adapter.getPersistentVolumes).mockResolvedValue([
        { metadata: { name: 'pv-one' }, spec: { csi: { driver: 'driver.longhorn.io' } } },
        { metadata: { name: 'pv-two' }, spec: { csi: { driver: 'driver.longhorn.io' } } },
    ] as never);
    vi.mocked(adapter.getSamples).mockResolvedValue([
        { pvcRef: { namespace: 'one', name: 'pvc-base' }, time: new Date(now).toISOString(), usedBytes: 4, availableBytes: 6, capacityBytes: 10 },
        { pvcRef: { namespace: 'two', name: 'pvc-base' }, time: new Date(now - 600_000).toISOString(), usedBytes: 8, availableBytes: 2, capacityBytes: 10 },
    ]);
    const result = await filesystem.getVolumeFilesystemUsage([
        { id: 'base', sharedVolumeId: null, projectId: 'one' },
        { id: 'shared', sharedVolumeId: 'base', projectId: 'one' },
        { id: 'other', sharedVolumeId: 'base', projectId: 'two' },
        { id: 'missing', sharedVolumeId: null, projectId: 'one' },
    ]);
    expect(result.get('base')).toMatchObject({ status: 'available', usedBytes: 4 });
    expect(result.get('shared')).toEqual(result.get('base'));
    expect(result.get('other')).toMatchObject({ status: 'stale' });
    expect(result.get('missing')).toMatchObject({ status: 'unavailable' });
});
