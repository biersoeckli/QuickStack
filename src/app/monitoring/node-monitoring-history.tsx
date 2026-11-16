'use client';

import { useCallback, useState } from 'react';
import { HistoryChart, getMonitoringRangeOptions, getMonitoringRangeStart } from '@/components/custom/app-monitoring-history';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePolling } from '@/frontend/hooks/use-polling';
import { getNodeMonitoringHistory } from './actions';

type History = NonNullable<Awaited<ReturnType<typeof getNodeMonitoringHistory>>['data']>;

export default function NodeMonitoringHistory() {
  const [history, setHistory] = useState<History>();
  const [error, setError] = useState(false);
  const [range, setRange] = useState('1h');
  const refresh = useCallback(async () => {
    try {
      const result = await getNodeMonitoringHistory();
      if (result.status !== 'success' || !result.data) { throw new Error('Unable to load monitoring history'); }
      setHistory(result.data);
      setError(false);
    } catch {
      setError(true);
    }
  }, []);
  usePolling(refresh, { intervalMs: 60_000, runImmediately: true });
  const options = getMonitoringRangeOptions(history?.retentionHours ?? 1);
  const selected = options.find((option) => option.value === range) ?? options[0];
  const points = history?.points.filter((point) => point.time >= getMonitoringRangeStart(selected.value, selected.hours)) ?? [];
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Cluster history</h2>
        <Select
          value={selected.value}
          onValueChange={(value) => {
            if (value) { setRange(value); }
          }}
        >
          <SelectTrigger aria-label="History time range">
            <SelectValue>{selected.label}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p className="text-sm text-muted-foreground">Totals include only nodes reporting each metric. Missing nodes or metrics are excluded.</p>
      {error && <p role="alert">Unable to load monitoring history.</p>}
      {history && history.points.length === 0 && <p>No measurements yet. History is collected every five minutes.</p>}
      {history?.points.at(-1)?.isGap && <p>Collection has stopped or is delayed. The chart shows a gap after the last sample.</p>}
      {history && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <HistoryChart title="CPU" data={points} dataKey="cpuCores" unit="cores" selectedRangeHours={selected.hours} />
          <HistoryChart title="RAM" data={points} dataKey="ramBytes" unit="bytes" selectedRangeHours={selected.hours} />
          <HistoryChart title="Storage" data={points} dataKey="diskBytes" unit="bytes" selectedRangeHours={selected.hours} />
        </div>
      )}
    </section>
  );
}
