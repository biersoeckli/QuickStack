import { MonitoringHistoryUtils } from './monitoring-history.utils';

type Sample = { sampledAt: Date; cpuCores: number | null; ramBytes: number | null; diskBytes: number | null };
type Point = { time: number; cpuCores: number | null; ramBytes: number | null; diskBytes: number | null; isGap?: boolean };

export class NodeMonitoringHistoryUtils {
  static aggregate(samples: Sample[], now = Date.now()): Point[] {
    const groups = new Map<number, Sample[]>();
    for (const sample of samples) {
      const time = sample.sampledAt.getTime();
      groups.set(time, [...(groups.get(time) ?? []), sample]);
    }
    const points: Point[] = [];
    const gap = (time: number): Point => ({ time, isGap: true, cpuCores: null, ramBytes: null, diskBytes: null });
    for (const [time, group] of [...groups].sort(([a], [b]) => a - b)) {
      const last = points.at(-1);
      if (last && time - last.time > MonitoringHistoryUtils.GAP_THRESHOLD_MS) points.push(gap(last.time + MonitoringHistoryUtils.COLLECTION_INTERVAL_MS));
      const sum = (key: 'cpuCores' | 'ramBytes' | 'diskBytes') =>
        group.every((sample) => sample[key] !== null) ? group.reduce((total, sample) => total + sample[key]!, 0) : null;
      points.push({ time, cpuCores: sum('cpuCores'), ramBytes: sum('ramBytes'), diskBytes: sum('diskBytes') });
    }
    const last = points.at(-1);
    if (last && now - last.time > MonitoringHistoryUtils.GAP_THRESHOLD_MS) points.push(gap(now));
    return points;
  }
}
