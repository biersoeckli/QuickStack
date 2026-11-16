import { NodeMonitoringHistoryUtils } from './node-monitoring-history.utils';

it('sums available node measurements and leaves fully unavailable metrics as a gap', () => {
  const points = NodeMonitoringHistoryUtils.aggregate(
    [
      { sampledAt: new Date(0), cpuCores: 1, ramBytes: 100, diskBytes: null },
      { sampledAt: new Date(0), cpuCores: 2, ramBytes: null, diskBytes: null }
    ],
    0
  );
  expect(points).toEqual([{ time: 0, cpuCores: 3, ramBytes: 100, diskBytes: null }]);
});
