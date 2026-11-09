'use client';

import { useCallback, useState } from 'react';
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, type ChartConfig } from '@/components/ui/chart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { KubeSizeConverter } from '@/shared/utils/kubernetes-size-converter.utils';
import { usePolling } from '@/frontend/hooks/use-polling';
import { PodsResourceInfoModel } from '@/shared/model/pods-resource-info.model';
import { AppMonitoringHistory } from '@/shared/model/app-monitoring-history.model';
import { getAppMonitoringHistory as getOneHistory } from '@/app/project/[projectId]/apps/details/deployments/actions';
import FullLoadingSpinner from '../ui/full-loading-spinnter';

function HistoryChart({
  title,
  data,
  dataKey,
  unit,
  currentValue,
  currentPercent,
  selectedRangeHours,
  useCurrentValue = false
}: {
  title: string;
  data: object[];
  dataKey: string;
  unit: string;
  selectedRangeHours: number;
  currentValue?: number;
  currentPercent?: number;
  useCurrentValue?: boolean;
}) {
  const visibleSamples = data.filter((point) => (point as Record<string, unknown>)[dataKey] != null);
  const latestValue = [...visibleSamples].reverse().map((point) => (point as Record<string, number>)[dataKey])[0];
  const formatValue = (value: number, axis = false) =>
    unit === 'bytes'
      ? KubeSizeConverter.convertBytesToReadableSize(value, axis ? 1 : 2)
      : `${new Intl.NumberFormat(undefined, { maximumSignificantDigits: axis ? 2 : 6 }).format(value)}${axis ? '' : ' cores'}`;
  const config = { [dataKey]: { label: title, color: 'var(--chart-2)' } } satisfies ChartConfig;
  return (
    <Card size="sm" className="min-w-0">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {currentPercent !== undefined && currentValue !== undefined ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger render={<button type="button" className="w-fit text-left text-2xl font-semibold tabular-nums" />}>
                {currentPercent.toFixed(2)}%
              </TooltipTrigger>
              <TooltipContent>{currentValue} cores</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <div className="text-2xl font-semibold tabular-nums">
            {useCurrentValue
              ? currentValue === undefined
                ? 'Unavailable'
                : formatValue(currentValue)
              : latestValue === undefined
                ? 'Unavailable'
                : formatValue(latestValue)}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {visibleSamples.length === 0 ? (
          <p className="text-sm text-muted-foreground">No measurements available.</p>
        ) : (
          <ChartContainer config={config} className="h-48 w-full">
            <LineChart accessibilityLayer data={data}>
              <CartesianGrid vertical={false} />
              <XAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                dataKey="time"
                type="number"
                domain={['dataMin', 'dataMax']}
                tickFormatter={(value) =>
                  new Date(value).toLocaleTimeString([], {
                    ...(selectedRangeHours > 24 ? ({ month: 'short', day: 'numeric' } as const) : ({ hour: '2-digit', minute: '2-digit' } as const))
                  })
                }
              />
              <YAxis width={70} tickLine={false} axisLine={false} tickFormatter={(value) => formatValue(value, true)} />
              <ChartTooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const item = payload[0];
                  return (
                    <div className="rounded-lg border bg-background p-3 text-sm shadow-sm">
                      <p>{new Date(Number(label)).toLocaleString()}</p>
                      <p>{typeof item.value === 'number' ? formatValue(item.value) : 'Unavailable'}</p>
                    </div>
                  );
                }}
              />
              <Line
                type="monotone"
                dataKey={dataKey}
                stroke={`var(--color-${dataKey})`}
                strokeWidth={2}
                connectNulls={false}
                dot={visibleSamples.length === 1}
                isAnimationActive={false}
              />
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

export default function AppMonitoringHistoryView({ appId, currentUsage }: { appId: string; currentUsage?: PodsResourceInfoModel }) {
  const [history, setHistory] = useState<AppMonitoringHistory>();
  const [error, setError] = useState(false);
  const [range, setRange] = useState('1h');
  const refresh = useCallback(async () => {
    try {
      const response = await getOneHistory(appId);
      if (response.status !== 'success' || !response.data) {
        throw new Error(response.message ?? 'Unable to load history');
      }
      setHistory(response.data);
      setError(false);
    } catch {
      setError(true);
    }
  }, [appId]);
  usePolling(refresh, { intervalMs: 60_000, runImmediately: true });
  const retentionHours = history?.retentionHours ?? 1;
  const options = [
    { value: '1h', label: 'Last hour', hours: 1 },
    { value: '5h', label: 'Last 5 hours', hours: 5 },
    { value: 'today', label: 'Today', hours: 24 },
    { value: '48h', label: 'Last 48 hours', hours: 48 },
    { value: '7d', label: 'Last 7 days', hours: 168 }
  ].filter((option) => option.hours <= retentionHours);
  if (![1, 5, 48, 168].includes(retentionHours)) {
    options.push({ value: 'all', label: `Last ${retentionHours} hours`, hours: retentionHours });
  }
  const selectedRange = options.find((option) => option.value === range) ?? options[0];
  const now = Date.now();
  const start = selectedRange.value === 'today' ? new Date(new Date(now).setHours(0, 0, 0, 0)).getTime() : now - selectedRange.hours * 60 * 60_000;
  const visiblePoints = history?.points.filter((point) => point.time >= start) ?? [];
  const collectionStopped = history?.points.at(-1)?.isGap;
  const sampleCount = visiblePoints.filter((point) => !point.isGap).length;

  return (
    <section className="flex min-h-full flex-1 flex-col gap-4 p-1 pt-0 pb-4">
      <div className="flex flex-1 flex-col gap-4">
        {history && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="pl-1 text-lg font-semibold text-foreground/80">Stats</h3>
            <Select
              value={selectedRange.value}
              onValueChange={(value) => {
                if (value) setRange(value);
              }}
            >
              <SelectTrigger aria-label="History time range">
                <SelectValue>{selectedRange.label}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        )}
        {error && <p role="alert">Unable to load monitoring history.</p>}
        {!history && !error && (
          <div className="flex flex-1 items-center justify-center">
            <FullLoadingSpinner />
          </div>
        )}
        {history && history.points.length === 0 && <p>No measurements yet. History is collected every five minutes.</p>}
        {history && (
          <>
            {collectionStopped && <p>Collection has stopped or is delayed. The chart shows a gap after the last sample.</p>}
            {sampleCount === 1 && <p>One sample collected. More samples will show a trend.</p>}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <HistoryChart
                title="CPU"
                data={visiblePoints}
                dataKey="cpuCores"
                unit="cores"
                selectedRangeHours={selectedRange.hours}
                useCurrentValue
                currentValue={currentUsage?.cpuAbsolutCores}
                currentPercent={currentUsage?.cpuPercent}
              />
              <HistoryChart
                title="RAM"
                data={visiblePoints}
                dataKey="ramBytes"
                unit="bytes"
                selectedRangeHours={selectedRange.hours}
                useCurrentValue
                currentValue={currentUsage?.ramAbsolutBytes}
              />
              {history.volumes.map((volume) => {
                return (
                  <HistoryChart
                    key={volume.id}
                    title={`Volume ${volume.label}`}
                    data={volume.points.filter((point) => point.time >= start)}
                    dataKey="usedBytes"
                    unit="bytes"
                    selectedRangeHours={selectedRange.hours}
                  />
                );
              })}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
