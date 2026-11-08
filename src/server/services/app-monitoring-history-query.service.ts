import appHistoryService from '@/server/services/standalone-services/app-history.service';
import { AppHistoryPoint, AppMonitoringHistory, AppVolumeHistory } from '@/shared/model/app-monitoring-history.model';

class AppMonitoringHistoryQueryService {
    async getHistory(appIds: string[]): Promise<AppMonitoringHistory> {
        const retention = await appHistoryService.getRetentionHours();
        const [apps, volumes] = await appHistoryService.getHistory(appIds, new Date(Date.now() - retention * 3600_000));
        const appsByTime = new Map<number, typeof apps>();
        const volumesByTime = new Map<number, typeof volumes>();
        for (const item of apps) {
            const time = item.sampledAt.getTime();
            const group = appsByTime.get(time) ?? [];
            group.push(item);
            appsByTime.set(time, group);
        }
        for (const item of volumes) {
            const time = item.sampledAt.getTime();
            const group = volumesByTime.get(time) ?? [];
            group.push(item);
            volumesByTime.set(time, group);
        }
        const times = new Set([...appsByTime.keys(), ...volumesByTime.keys()]);
        const points: AppHistoryPoint[] = [];
        let latestCpuMeasurement: number | null = null;
        let latestRamMeasurement: number | null = null;
        let latestVolumeMeasurement: number | null = null;
        const volumeSeries = new Map<string, AppVolumeHistory>();
        for (const time of [...times].sort((a, b) => a - b)) {
            if (points.length && time - points[points.length - 1].time > 7 * 60_000) {
                points.push({ time: points[points.length - 1].time + 5 * 60_000, isGap: true, cpuCores: null, ramBytes: null, storageBytes: null, availableVolumes: 0, unavailableVolumes: 0 });
            }
            const currentApps = appsByTime.get(time) ?? [];
            const currentVolumes = volumesByTime.get(time) ?? [];
            const uniqueVolumes = new Map<string, typeof currentVolumes[number]>();
            for (const item of currentVolumes) {
                const key = `${item.volume.app.projectId}/${item.volume.sharedVolumeId ?? item.volumeId}`;
                if (!uniqueVolumes.has(key) || item.status === 'available') uniqueVolumes.set(key, item);
                let series = volumeSeries.get(item.volumeId);
                if (!series) {
                    series = { id: item.volumeId, label: item.volume.containerMountPath, points: [] };
                    volumeSeries.set(item.volumeId, series);
                }
                if (series.points.length && time - series.points[series.points.length - 1].time > 7 * 60_000) {
                    series.points.push({ time: series.points[series.points.length - 1].time + 5 * 60_000, usedBytes: null, measuredAt: null });
                }
                series.points.push({ time, usedBytes: item.status === 'available' ? item.usedBytes : null, measuredAt: item.measuredAt?.getTime() ?? null });
            }
            if (currentApps.length && currentApps.every(item => item.cpuCores !== null && item.measuredAt)) {
                latestCpuMeasurement = Math.max(latestCpuMeasurement ?? 0, Math.min(...currentApps.map(item => item.measuredAt!.getTime())));
            }
            if (currentApps.length && currentApps.every(item => item.ramBytes !== null && item.measuredAt)) {
                latestRamMeasurement = Math.max(latestRamMeasurement ?? 0, Math.min(...currentApps.map(item => item.measuredAt!.getTime())));
            }
            const available = [...uniqueVolumes.values()].filter(item => item.status === 'available' && item.usedBytes !== null);
            if (available.length && available.every(item => item.measuredAt)) {
                latestVolumeMeasurement = Math.max(latestVolumeMeasurement ?? 0, Math.min(...available.map(item => item.measuredAt!.getTime())));
            }
            points.push({
                time,
                cpuCores: currentApps.length && currentApps.every(item => item.cpuCores !== null) ? currentApps.reduce((sum, item) => sum + item.cpuCores!, 0) : null,
                ramBytes: currentApps.length && currentApps.every(item => item.ramBytes !== null) ? currentApps.reduce((sum, item) => sum + item.ramBytes!, 0) : null,
                storageBytes: available.length ? available.reduce((sum, item) => sum + item.usedBytes!, 0) : null,
                availableVolumes: available.length,
                unavailableVolumes: uniqueVolumes.size - available.length,
            });
        }
        const now = Date.now();
        const lastPoint = points.at(-1);
        if (lastPoint && now - lastPoint.time > 7 * 60_000) {
            points.push({
                time: now,
                isGap: true,
                cpuCores: null,
                ramBytes: null,
                storageBytes: null,
                availableVolumes: 0,
                unavailableVolumes: 0,
            });
        }
        for (const volume of volumeSeries.values()) {
            const lastSample = volume.points.at(-1);
            if (lastSample && now - lastSample.time > 7 * 60_000) {
                volume.points.push({ time: now, usedBytes: null, measuredAt: null });
            }
        }
        return { retentionHours: retention, points, volumes: [...volumeSeries.values()], latestCpuMeasurement, latestRamMeasurement, latestVolumeMeasurement };
    }
}
const appMonitoringHistoryQueryService = new AppMonitoringHistoryQueryService();
export default appMonitoringHistoryQueryService;
