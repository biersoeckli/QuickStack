'use client';

import { useCallback, useState } from 'react';
import { HistoryChart, getMonitoringRangeStart } from '@/components/custom/app-monitoring-history';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { KubeSizeConverter } from '@/shared/utils/kubernetes-size-converter.utils';
import { NodeResourceModel } from '@/shared/model/node-resource.model';
import { usePolling } from '@/frontend/hooks/use-polling';
import { getNodeMonitoringHistory } from './actions';

type History = NonNullable<Awaited<ReturnType<typeof getNodeMonitoringHistory>>['data']>;

export default function NodeMonitoringHistory({
  selectedRange,
  onRetentionHoursChange,
  nodes,
  nodesLoading = false
}: {
  selectedRange: { value: string; hours: number };
  onRetentionHoursChange: (hours: number) => void;
  nodes?: NodeResourceModel[];
  nodesLoading?: boolean;
}) {
  const [history, setHistory] = useState<History>();
  const [error, setError] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const result = await getNodeMonitoringHistory();
      if (result.status !== 'success' || !result.data) {
        throw new Error('Unable to load monitoring history');
      }
      setHistory(result.data);
      onRetentionHoursChange(result.data.retentionHours);
      setError(false);
    } catch {
      setError(true);
    }
  }, [onRetentionHoursChange]);
  usePolling(refresh, { intervalMs: 60_000, runImmediately: true });
  const points = history?.points.filter((point) => point.time >= getMonitoringRangeStart(selectedRange.value, selectedRange.hours)) ?? [];
  const capacities = nodes?.reduce(
    (total, node) => ({
      cpuCores: total.cpuCores + node.cpuCapacity,
      ramBytes: total.ramBytes + node.ramCapacity,
      diskBytes: total.diskBytes + (node.diskUsageCapacity ?? 0)
    }),
    { cpuCores: 0, ramBytes: 0, diskBytes: 0 }
  );
  const chartPoints = points.map((point) => ({
    ...point,
    cpuCores: point.cpuCores != null && capacities?.cpuCores ? (point.cpuCores / capacities.cpuCores) * 100 : null,
    ramBytes: point.ramBytes != null && capacities?.ramBytes ? (point.ramBytes / capacities.ramBytes) * 100 : null,
    diskBytes:
      point.diskBytes != null && capacities?.diskBytes && nodes?.every((node) => node.diskUsageCapacity !== undefined)
        ? (point.diskBytes / capacities.diskBytes) * 100
        : null
  }));
  const summary = (key: 'cpu' | 'ram' | 'disk') => {
    const reporting =
      nodes?.filter((node) =>
        key === 'cpu' ? node.cpuUsage != null : key === 'ram' ? node.ramUsage != null : node.diskUsageAbsolut != null && node.diskUsageCapacity != null
      ) ?? [];
    const used = reporting.reduce((sum, node) => sum + (key === 'cpu' ? node.cpuUsage! : key === 'ram' ? node.ramUsage! : node.diskUsageAbsolut!), 0);
    const capacity = reporting.reduce((sum, node) => sum + (key === 'cpu' ? node.cpuCapacity : key === 'ram' ? node.ramCapacity : node.diskUsageCapacity!), 0);
    if (!capacity) {
      return { percent: undefined, subtitle: 'Current usage unavailable' };
    }
    const format =
      key === 'cpu' ? (value: number) => `${Number(value.toFixed(2))} cores` : (value: number) => KubeSizeConverter.convertBytesToReadableSize(value);
    const incomplete = reporting.length !== nodes?.length ? ' (reporting nodes)' : '';
    return { percent: (used / capacity) * 100, subtitle: `${format(used)} / ${format(capacity)}${incomplete}` };
  };
  const cpu = summary('cpu');
  const ram = summary('ram');
  const disk = summary('disk');
  const loading = (!history && !error) || nodesLoading;
  return (
    <section className="space-y-4">
      {error && <p role="alert">Unable to load monitoring history.</p>}
      {loading && (
        <Card size="sm" className="pb-0" role="status" aria-label="Loading cluster history">
          <div className="grid grid-cols-1 divide-y divide-border lg:grid-cols-3 lg:divide-x lg:divide-y-0">
            {['CPU', 'RAM', 'Storage'].map((metric) => (
              <div key={metric} className="flex min-w-0 flex-col gap-2 py-4 first:pt-0 last:pb-0 lg:py-0" aria-hidden="true">
                <CardHeader className="-space-y-1.5">
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-8 w-24" />
                  <Skeleton className="h-5 w-40" />
                </CardHeader>
                <CardContent>
                  <div className="flex h-20 items-start pb-3">
                    <Skeleton className="h-full w-full" />
                  </div>
                </CardContent>
              </div>
            ))}
          </div>
        </Card>
      )}
      {!loading && history && history.points.length === 0 && <p>No measurements yet. History is collected every five minutes.</p>}
      {!loading && history?.points.at(-1)?.isGap && <p>Collection has stopped or is delayed. The chart shows a gap after the last sample.</p>}
      {!loading && history && (
        <Card size="sm" className="pb-0">
          <div className="grid grid-cols-1 divide-y divide-border lg:grid-cols-3 lg:divide-x lg:divide-y-0 [&>div]:py-4 lg:[&>div]:py-0 [&>div:first-child]:pt-0 [&>div:last-child]:pb-0">
            <HistoryChart
              title="CPU"
              data={chartPoints}
              dataKey="cpuCores"
              unit="percent"
              useCurrentValue
              currentValue={cpu.percent}
              subtitle={cpu.subtitle}
              selectedRangeHours={selectedRange.hours}
              compact
              embedded
            />
            <HistoryChart
              title="RAM"
              data={chartPoints}
              dataKey="ramBytes"
              unit="percent"
              useCurrentValue
              currentValue={ram.percent}
              subtitle={ram.subtitle}
              selectedRangeHours={selectedRange.hours}
              compact
              embedded
            />
            <HistoryChart
              title="Storage"
              data={chartPoints}
              dataKey="diskBytes"
              unit="percent"
              useCurrentValue
              currentValue={disk.percent}
              subtitle={disk.subtitle}
              selectedRangeHours={selectedRange.hours}
              compact
              embedded
            />
          </div>
        </Card>
      )}
    </section>
  );
}
