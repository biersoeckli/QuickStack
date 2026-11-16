vi.mock('@/server/adapter/db.client', () => ({ default: { client: {} } }));
vi.mock('./monitoring-history.service', () => ({ default: { getRetentionHours: vi.fn() } }));
vi.mock('./app-history.service', () => ({ default: { getAppMetrics: vi.fn() } }));
vi.mock('./app-volume-filesystem.service', () => ({ default: { getVolumeFilesystemUsage: vi.fn() } }));
vi.mock('./schedule.service', () => ({ default: { scheduleJob: vi.fn() } }));
import history from './app-monitoring-history.service';
import monitoringHistory from './monitoring-history.service';

const getPopulation = vi.spyOn(history, 'getPopulation');
const save = vi.spyOn(history, 'save').mockResolvedValue(undefined);
import metrics from './app-history.service';
import filesystem from './app-volume-filesystem.service';

it('records a gap for failed App metrics while preserving successful volume data', async () => {
  getPopulation.mockResolvedValue({
    apps: [{ id: 'app', projectId: 'p' }],
    volumes: [{ id: 'v', appId: 'app', sharedVolumeId: null, app: { projectId: 'p' } }]
  } as never);
  vi.mocked(monitoringHistory.getRetentionHours).mockResolvedValue(24);
  vi.mocked(metrics.getAppMetrics).mockRejectedValue(new Error('metrics unavailable'));
  vi.mocked(filesystem.getVolumeFilesystemUsage).mockResolvedValue(new Map([['v', { pvcName: 'pvc-v', status: 'available', usedBytes: 4 }]]));
  await history.collect();
  expect(save).toHaveBeenCalledWith(
    [expect.objectContaining({ appId: 'app', cpuCores: null, ramBytes: null })],
    [expect.objectContaining({ volumeId: 'v', status: 'available', usedBytes: 4 })],
    [expect.objectContaining({ volumeId: 'v' })],
    expect.any(Date)
  );
});

it('does not start a second collection while the first is running', async () => {
  vi.clearAllMocks();
  let release!: (value: { apps: never[]; volumes: never[] }) => void;
  getPopulation.mockReturnValue(
    new Promise((resolve) => {
      release = resolve;
    })
  );
  vi.mocked(monitoringHistory.getRetentionHours).mockResolvedValue(24);
  vi.mocked(metrics.getAppMetrics).mockResolvedValue(new Map());
  vi.mocked(filesystem.getVolumeFilesystemUsage).mockResolvedValue(new Map());
  const first = history.collect();
  await history.collect();
  expect(getPopulation).toHaveBeenCalledTimes(1);
  release({ apps: [], volumes: [] });
  await first;
});

it('stores one filesystem measurement for a shared Volume with a link for each mount', async () => {
  vi.clearAllMocks();
  getPopulation.mockResolvedValue({
    apps: [],
    volumes: [
      { id: 'v', appId: 'app', sharedVolumeId: null, app: { projectId: 'p' } },
      { id: 'shared', appId: 'other', sharedVolumeId: 'v', app: { projectId: 'p' } }
    ]
  } as never);
  vi.mocked(monitoringHistory.getRetentionHours).mockResolvedValue(24);
  vi.mocked(metrics.getAppMetrics).mockResolvedValue(new Map());
  vi.mocked(filesystem.getVolumeFilesystemUsage).mockResolvedValue(new Map([['v', { pvcName: 'pvc-v', status: 'available', usedBytes: 4 }]]));
  await history.collect();
  const [, samples, memberships] = save.mock.calls[0];
  expect(samples).toHaveLength(1);
  expect(memberships).toHaveLength(2);
});

it('collects promptly on startup and resumes collection after a restart', async () => {
  vi.clearAllMocks();
  getPopulation.mockResolvedValue({ apps: [], volumes: [] });
  vi.mocked(monitoringHistory.getRetentionHours).mockResolvedValue(24);
  vi.mocked(metrics.getAppMetrics).mockResolvedValue(new Map());
  vi.mocked(filesystem.getVolumeFilesystemUsage).mockResolvedValue(new Map());
  history.initialize();
  await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  history.initialize();
  await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2));
});
