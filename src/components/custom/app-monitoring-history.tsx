'use client';

import { useCallback, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePolling } from '@/frontend/hooks/use-polling';
import { AppMonitoringHistory } from '@/shared/model/app-monitoring-history.model';
import { getAppMonitoringHistory as getAllHistory } from '@/app/monitoring/actions';
import { getAppMonitoringHistory as getOneHistory } from '@/app/project/[projectId]/apps/details/deployments/actions';

function HistoryChart({ title, data, dataKey, unit }: { title: string; data: object[]; dataKey: string; unit: string }) {
    return <div className="flex flex-col gap-2">
        <h4 className="text-sm font-medium">{title} ({unit})</h4>
        <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" type="number" domain={['dataMin', 'dataMax']} tickFormatter={value => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} />
                    <YAxis width={70} />
                    <Tooltip content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        const item = payload[0];
                        const sample = item.payload as { availableVolumes?: number; unavailableVolumes?: number };
                        return <div className="rounded-md border bg-background p-2 text-sm shadow-sm">
                            <p>{new Date(Number(label)).toLocaleString()}</p>
                            <p>{item.value} {unit}</p>
                            {dataKey === 'storageBytes' && <p>{sample.availableVolumes} available, {sample.unavailableVolumes} unavailable{sample.unavailableVolumes ? ' (incomplete total)' : ''}</p>}
                        </div>;
                    }} />
                    <Line type="linear" dataKey={dataKey} stroke="var(--chart-1)" connectNulls={false} dot={data.length === 1} isAnimationActive={false} />
                </LineChart>
            </ResponsiveContainer>
        </div>
    </div>;
}

function freshness(time: number | null) {
    if (!time) return 'Measurement unavailable';
    return `Latest successful measurement: ${new Date(time).toLocaleString()}${Date.now() - time > 10 * 60_000 ? ' (stale)' : ''}`;
}

export default function AppMonitoringHistoryView({ appId }: { appId?: string }) {
    const [history, setHistory] = useState<AppMonitoringHistory>();
    const [error, setError] = useState(false);
    const refresh = useCallback(async () => {
        try {
            const response = appId ? await getOneHistory(appId) : await getAllHistory();
            if (response.status !== 'success' || !response.data) throw new Error(response.message ?? 'Unable to load history');
            setHistory(response.data);
            setError(false);
        } catch {
            setError(true);
        }
    }, [appId]);
    usePolling(refresh, { intervalMs: 60_000, runImmediately: true });
    const latest = history?.points[history.points.length - 1];
    return <Card>
        <CardHeader><CardTitle>{appId ? 'App history' : 'App totals history'}</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-6">
            {error && <p role="alert">Unable to load monitoring history.</p>}
            {!history && !error && <p>Loading monitoring history…</p>}
            {history && history.points.length === 0 && <p>No measurements yet. History is collected every five minutes.</p>}
            {history && history.points.length > 0 && <>
                {history.points.length === 1 && <p>One sample collected. More samples will show a trend.</p>}
                <p className="text-sm text-muted-foreground">CPU is an average over the Kubernetes metrics source window; short peaks may be missed.</p>
                <HistoryChart title={appId ? 'CPU' : 'App CPU total'} data={history.points} dataKey="cpuCores" unit="cores" />
                <p className="text-sm text-muted-foreground">{freshness(history.latestCpuMeasurement)}</p>
                <HistoryChart title={appId ? 'RAM working set' : 'App RAM working set total'} data={history.points} dataKey="ramBytes" unit="bytes" />
                <p className="text-sm text-muted-foreground">{freshness(history.latestRamMeasurement)}</p>
                <p className="text-sm text-muted-foreground">{freshness(history.latestVolumeMeasurement)}</p>
                {!appId && <>
                    <HistoryChart title="App Volume used space (available volumes only)" data={history.points} dataKey="storageBytes" unit="bytes" />
                    {latest && <p className="text-sm">Latest sample: {latest.availableVolumes} available and {latest.unavailableVolumes} unavailable volumes{latest.unavailableVolumes ? ' (incomplete total)' : ''}.</p>}
                </>}
                {appId && history.volumes.length === 0 && <p>No App Volume measurements.</p>}
                {appId && history.volumes.map(volume => <div key={volume.id} className="flex flex-col gap-2">
                    <HistoryChart title={`Volume ${volume.label}`} data={volume.points} dataKey="usedBytes" unit="bytes" />
                    <p className="text-sm text-muted-foreground">{freshness(volume.points.reduce<number | null>((latest, point) => point.usedBytes !== null && point.measuredAt ? Math.max(latest ?? 0, point.measuredAt) : latest, null))}</p>
                </div>)}
            </>}
        </CardContent>
    </Card>;
}
