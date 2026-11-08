vi.mock('@/server/adapter/db.client', () => ({ default: { client: {} } }));

import appHistoryMetricsService from './app-history.service';

vi.mock('@/server/adapter/app-history-metrics.adapter', () => ({
    default: { getPods: vi.fn(), getMetrics: vi.fn() },
}));

import metricsAdapter from '@/server/adapter/app-history-metrics.adapter';

it('marks an App incomplete when a running container has no metrics', async () => {
    vi.mocked(metricsAdapter.getPods).mockResolvedValue([
        { metadata: { name: 'pod', namespace: 'project', labels: { app: 'app' } }, status: { phase: 'Running' }, spec: { containers: [{ name: 'one' }, { name: 'two' }] } },
    ] as never);
    vi.mocked(metricsAdapter.getMetrics).mockResolvedValue([
        { metadata: { name: 'pod', namespace: 'project' }, timestamp: new Date().toISOString(), containers: [{ name: 'one', usage: { cpu: '250m', memory: '1Mi' } }] },
    ] as never);

    const result = await appHistoryMetricsService.getAppMetrics([{ id: 'app', projectId: 'project' }]);
    expect(result.get('app')).toMatchObject({ cpuCores: null, ramBytes: null });
});

it('matches pod metrics by namespace and sums complete containers', async () => {
    vi.mocked(metricsAdapter.getPods).mockResolvedValue([
        { metadata: { name: 'pod', namespace: 'project', labels: { app: 'app' } }, status: { phase: 'Running' }, spec: { containers: [{ name: 'one' }] } },
    ] as never);
    vi.mocked(metricsAdapter.getMetrics).mockResolvedValue([
        { metadata: { name: 'pod', namespace: 'other' }, timestamp: new Date().toISOString(), containers: [{ name: 'one', usage: { cpu: '9', memory: '9Mi' } }] },
        { metadata: { name: 'pod', namespace: 'project' }, timestamp: new Date().toISOString(), containers: [{ name: 'one', usage: { cpu: '250m', memory: '1Mi' } }] },
    ] as never);
    const result = await appHistoryMetricsService.getAppMetrics([{ id: 'app', projectId: 'project' }]);
    expect(result.get('app')).toMatchObject({ cpuCores: 0.25, ramBytes: 1048576 });
});

it('preserves RAM when CPU measurement is missing', async () => {
    vi.mocked(metricsAdapter.getPods).mockResolvedValue([
        { metadata: { name: 'pod', namespace: 'project', labels: { app: 'app' } }, status: { phase: 'Running' }, spec: { containers: [{ name: 'one' }] } },
    ] as never);
    vi.mocked(metricsAdapter.getMetrics).mockResolvedValue([
        { metadata: { name: 'pod', namespace: 'project' }, timestamp: new Date().toISOString(), containers: [{ name: 'one', usage: { memory: '1Mi' } }] },
    ] as never);
    const result = await appHistoryMetricsService.getAppMetrics([{ id: 'app', projectId: 'project' }]);
    expect(result.get('app')).toMatchObject({ cpuCores: null, ramBytes: 1048576 });
});
