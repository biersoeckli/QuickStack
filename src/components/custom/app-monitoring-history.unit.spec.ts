import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import AppMonitoringHistoryView from './app-monitoring-history';
import { getAppMonitoringHistory } from '@/app/monitoring/actions';

vi.mock('@/app/monitoring/actions', () => ({ getAppMonitoringHistory: vi.fn() }));
vi.mock('@/app/project/[projectId]/apps/details/deployments/actions', () => ({ getAppMonitoringHistory: vi.fn() }));
vi.mock('recharts', () => ({
    CartesianGrid: () => null, Line: () => null, LineChart: () => null,
    ResponsiveContainer: () => null, Tooltip: () => null, XAxis: () => null, YAxis: () => null,
}));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it('shows an empty state before the first sample', async () => {
    vi.mocked(getAppMonitoringHistory).mockResolvedValue({ status: 'success', data: { points: [], volumes: [], latestCpuMeasurement: null, latestRamMeasurement: null, latestVolumeMeasurement: null } } as never);
    render(React.createElement(AppMonitoringHistoryView));
    expect(await screen.findByText(/No measurements yet/)).toBeTruthy();
});

it('labels partial App Volume totals with availability counts', async () => {
    vi.mocked(getAppMonitoringHistory).mockResolvedValue({ status: 'success', data: { points: [{ time: Date.now(), cpuCores: null, ramBytes: null, storageBytes: 10, availableVolumes: 1, unavailableVolumes: 2 }], volumes: [], latestCpuMeasurement: null, latestRamMeasurement: null, latestVolumeMeasurement: null } } as never);
    render(React.createElement(AppMonitoringHistoryView));
    expect(await screen.findByText(/1 available and 2 unavailable volumes \(incomplete total\)/)).toBeTruthy();
    expect(screen.getByText(/App CPU total/)).toBeTruthy();
});

it('shows an error when history cannot be loaded', async () => {
    vi.mocked(getAppMonitoringHistory).mockRejectedValue(new Error('unavailable'));
    render(React.createElement(AppMonitoringHistoryView));
    expect((await screen.findByRole('alert')).textContent).toContain('Unable to load monitoring history.');
});
