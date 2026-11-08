import { randomUUID } from 'crypto';
import appHistoryAdapter from '@/server/adapter/app-history.adapter';
import appHistoryMetricsService from './app-history-metrics.service';
import appVolumeFilesystemService from './app-volume-filesystem.service';
import scheduleService from './schedule.service';
import { KubeObjectNameUtils } from '@/server/utils/kube-object-name.utils';

class AppMonitoringHistoryService {
    private running = false;

    initialize() {
        scheduleService.scheduleJob('app-monitoring-history', '*/5 * * * *', () => { void this.collect(); });
        void this.collect();
    }

    async collect() {
        if (this.running) return;
        this.running = true;
        try {
            const sampledAt = new Date();
            const { apps, volumes } = await appHistoryAdapter.getPopulation();
            const [metrics, filesystem, retention] = await Promise.all([
                appHistoryMetricsService.getAppMetrics(apps).catch(error => { console.error('App metrics collection failed', error); return new Map(); }),
                appVolumeFilesystemService.getVolumeFilesystemUsage(volumes.map(volume => ({ ...volume, projectId: volume.app.projectId })))
                    .catch(error => { console.error('Volume metrics collection failed', error); return new Map(); }),
                appHistoryAdapter.getRetentionHours(),
            ]);
            const samples = new Map<string, { id: string; volumeId: string; sampledAt: Date; status: string; usedBytes: number | null; availableBytes: number | null; capacityBytes: number | null; measuredAt: Date | null }>();
            const memberships: { sampleId: string; volumeId: string }[] = [];
            for (const volume of volumes) {
                const underlyingId = volume.sharedVolumeId || volume.id;
                let sample = samples.get(underlyingId);
                if (!sample) {
                    const pvcName = KubeObjectNameUtils.toPvcName(underlyingId);
                    const usage = filesystem.get(`${volume.app.projectId}/${pvcName}`);
                    sample = { id: randomUUID(), volumeId: underlyingId, sampledAt, status: usage?.status ?? 'unavailable', usedBytes: usage?.usedBytes ?? null, availableBytes: usage?.availableBytes ?? null, capacityBytes: usage?.capacityBytes ?? null, measuredAt: usage?.measuredAt ? new Date(usage.measuredAt) : null };
                    samples.set(underlyingId, sample);
                }
                memberships.push({ sampleId: sample.id, volumeId: volume.id });
            }
            await appHistoryAdapter.save(
                apps.map(app => ({ appId: app.id, sampledAt, cpuCores: metrics.get(app.id)?.cpuCores ?? null, ramBytes: metrics.get(app.id)?.ramBytes ?? null, measuredAt: metrics.get(app.id)?.measuredAt ?? null })),
                [...samples.values()],
                memberships,
                new Date(sampledAt.getTime() - retention * 60 * 60 * 1000),
            );
        } catch (error) {
            console.error('App monitoring history collection failed', error);
        } finally {
            this.running = false;
        }
    }
}
const appMonitoringHistoryService = new AppMonitoringHistoryService();
export default appMonitoringHistoryService;
