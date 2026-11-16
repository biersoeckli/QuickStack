import { NodeMonitoringHistoryUtils } from './node-monitoring-history.utils';

it('sums complete node measurements and leaves each incomplete metric as a gap', () => {
  const points = NodeMonitoringHistoryUtils.aggregate(
    [
      { sampledAt: new Date(0), cpuCores: 1, ramBytes: 100, diskBytes: 400 },
      { sampledAt: new Date(0), cpuCores: 2, ramBytes: null, diskBytes: 200 }
    ],
    0
  );
  expect(points).toEqual([{ time: 0, cpuCores: 3, ramBytes: null, diskBytes: 600 }]);
});
