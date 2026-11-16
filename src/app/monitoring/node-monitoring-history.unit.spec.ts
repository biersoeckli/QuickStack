import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import NodeMonitoringHistory from './node-monitoring-history';
import { getNodeMonitoringHistory } from './actions';

vi.mock('./actions', () => ({ getNodeMonitoringHistory: vi.fn() }));
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

it('shows CPU, RAM and storage history with a shared range selector', async () => {
  vi.mocked(getNodeMonitoringHistory).mockResolvedValue({
    status: 'success',
    data: { retentionHours: 24, points: [{ time: Date.now(), cpuCores: 1, ramBytes: 1024, diskBytes: 2048 }] }
  } as never);
  render(React.createElement(NodeMonitoringHistory));
  expect(await screen.findByText('CPU')).toBeTruthy();
  expect(screen.getByText('RAM')).toBeTruthy();
  expect(screen.getByText('Storage')).toBeTruthy();
  expect(screen.getAllByRole('combobox', { name: 'History time range' })).toHaveLength(1);
});
