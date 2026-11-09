import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import AppMonitoringHistoryView from './app-monitoring-history';
import { getAppMonitoringHistory } from '@/app/project/[projectId]/apps/details/deployments/actions';

vi.mock('@/app/project/[projectId]/apps/details/deployments/actions', () => ({ getAppMonitoringHistory: vi.fn() }));
vi.mock('recharts', () => ({
  CartesianGrid: () => null,
  Line: () => null,
  LineChart: () => null,
  ResponsiveContainer: () => null,
  Tooltip: () => null,
  Legend: () => null,
  XAxis: () => null,
  YAxis: () => null
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it('shows an empty state before the first sample', async () => {
  vi.mocked(getAppMonitoringHistory).mockResolvedValue({
    status: 'success',
    data: { retentionHours: 24, points: [], volumes: [], latestCpuMeasurement: null, latestRamMeasurement: null, latestVolumeMeasurement: null }
  } as never);
  render(React.createElement(AppMonitoringHistoryView, { appId: 'app' }));
  expect(await screen.findByText(/No measurements yet/)).toBeTruthy();
  expect(screen.getByRole('combobox', { name: 'History time range' })).toBeTruthy();
});

it('shows an error when history cannot be loaded', async () => {
  vi.mocked(getAppMonitoringHistory).mockRejectedValue(new Error('unavailable'));
  render(React.createElement(AppMonitoringHistoryView, { appId: 'app' }));
  expect((await screen.findByRole('alert')).textContent).toContain('Unable to load monitoring history.');
});

it('shows a stopped collection gap without treating it as a new volume sample', async () => {
  const now = Date.now();
  vi.mocked(getAppMonitoringHistory).mockResolvedValue({
    status: 'success',
    data: {
      points: [
        { time: now - 900_000, cpuCores: 1, ramBytes: 2, storageBytes: 10, availableVolumes: 1, unavailableVolumes: 2 },
        { time: now, isGap: true, cpuCores: null, ramBytes: null, storageBytes: null, availableVolumes: 0, unavailableVolumes: 0 }
      ],
      volumes: [],
      latestCpuMeasurement: null,
      latestRamMeasurement: null,
      latestVolumeMeasurement: null
    }
  } as never);
  render(React.createElement(AppMonitoringHistoryView, { appId: 'app' }));
  expect(await screen.findByText(/Collection has stopped or is delayed/)).toBeTruthy();
});

it('updates app card values from current usage while keeping history', async () => {
  vi.mocked(getAppMonitoringHistory).mockResolvedValue({
    status: 'success',
    data: {
      points: [{ time: Date.now(), cpuCores: 1, ramBytes: 1024, storageBytes: null, availableVolumes: 0, unavailableVolumes: 0 }],
      volumes: [],
      latestCpuMeasurement: null,
      latestRamMeasurement: null,
      latestVolumeMeasurement: null
    }
  } as never);
  const { rerender } = render(
    React.createElement(AppMonitoringHistoryView, {
      appId: 'app',
      currentUsage: { cpuAbsolutCores: 2, cpuPercent: 12.345, ramAbsolutBytes: 2048, ramPercent: 0 }
    })
  );
  expect(await screen.findByText('12.35%')).toBeTruthy();
  rerender(
    React.createElement(AppMonitoringHistoryView, {
      appId: 'app',
      currentUsage: { cpuAbsolutCores: 3, cpuPercent: 25.6, ramAbsolutBytes: 4096, ramPercent: 0 }
    })
  );
  expect(screen.getByText('25.60%')).toBeTruthy();
});
