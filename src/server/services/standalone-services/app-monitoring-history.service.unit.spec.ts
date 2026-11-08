vi.mock('@/server/adapter/app-history.adapter', () => ({ default: { getPopulation: vi.fn(), getRetentionHours: vi.fn(), save: vi.fn() } }));
vi.mock('./app-history.service', () => ({ default: { getAppMetrics: vi.fn() } }));
vi.mock('./app-volume-filesystem.service', () => ({ default: { getVolumeFilesystemUsage: vi.fn() } }));
vi.mock('./schedule.service', () => ({ default: { scheduleJob: vi.fn() } }));
import history from './app-monitoring-history.service';
import adapter from '@/server/adapter/app-history.adapter';
import metrics from './app-history.service';
import filesystem from './app-volume-filesystem.service';

it('records a gap for failed App metrics while preserving successful volume data', async () => {
  vi.mocked(adapter.getPopulation).mockResolvedValue({
    apps: [{ id: 'app', projectId: 'p' }],
    volumes: [{ id: 'v', appId: 'app', sharedVolumeId: null, app: { projectId: 'p' } }]
  } as never);
  vi.mocked(adapter.getRetentionHours).mockResolvedValue(24);
  vi.mocked(metrics.getAppMetrics).mockRejectedValue(new Error('metrics unavailable'));
  vi.mocked(filesystem.getVolumeFilesystemUsage).mockResolvedValue(new Map([['v', { pvcName: 'pvc-v', status: 'available', usedBytes: 4 }]]));
  await history.collect();
  expect(adapter.save).toHaveBeenCalledWith(
    [expect.objectContaining({ appId: 'app', cpuCores: null, ramBytes: null })],
    [expect.objectContaining({ volumeId: 'v', status: 'available', usedBytes: 4 })],
    [expect.objectContaining({ volumeId: 'v' })],
    expect.any(Date)
  );
});

it('does not start a second collection while the first is running', async () => {
  vi.clearAllMocks();
  let release!: (value: { apps: never[]; volumes: never[] }) => void;
  vi.mocked(adapter.getPopulation).mockReturnValue(
    new Promise((resolve) => {
      release = resolve;
    })
  );
  vi.mocked(adapter.getRetentionHours).mockResolvedValue(24);
  vi.mocked(metrics.getAppMetrics).mockResolvedValue(new Map());
  vi.mocked(filesystem.getVolumeFilesystemUsage).mockResolvedValue(new Map());
  const first = history.collect();
  await history.collect();
  expect(adapter.getPopulation).toHaveBeenCalledTimes(1);
  release({ apps: [], volumes: [] });
  await first;
});

it('stores one filesystem measurement for a shared Volume with a link for each mount', async () => {
  vi.clearAllMocks();
  vi.mocked(adapter.getPopulation).mockResolvedValue({
    apps: [],
    volumes: [
      { id: 'v', appId: 'app', sharedVolumeId: null, app: { projectId: 'p' } },
      { id: 'shared', appId: 'other', sharedVolumeId: 'v', app: { projectId: 'p' } }
    ]
  } as never);
  vi.mocked(adapter.getRetentionHours).mockResolvedValue(24);
  vi.mocked(metrics.getAppMetrics).mockResolvedValue(new Map());
  vi.mocked(filesystem.getVolumeFilesystemUsage).mockResolvedValue(new Map([['v', { pvcName: 'pvc-v', status: 'available', usedBytes: 4 }]]));
  await history.collect();
  const [, samples, memberships] = vi.mocked(adapter.save).mock.calls[0];
  expect(samples).toHaveLength(1);
  expect(memberships).toHaveLength(2);
});

it('collects promptly on startup and resumes collection after a restart', async () => {
  vi.clearAllMocks();
  vi.mocked(adapter.getPopulation).mockResolvedValue({ apps: [], volumes: [] });
  vi.mocked(adapter.getRetentionHours).mockResolvedValue(24);
  vi.mocked(metrics.getAppMetrics).mockResolvedValue(new Map());
  vi.mocked(filesystem.getVolumeFilesystemUsage).mockResolvedValue(new Map());
  history.initialize();
  await vi.waitFor(() => expect(adapter.save).toHaveBeenCalledTimes(1));
  history.initialize();
  await vi.waitFor(() => expect(adapter.save).toHaveBeenCalledTimes(2));
});
