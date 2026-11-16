import { MonitoringHistoryUtils } from '@/shared/utils/monitoring-history.utils';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import appHistoryService from './app-history.service';
import dataAccess from '@/server/adapter/db.client';
import monitoringHistoryService from './monitoring-history.service';
import { ListUtils } from '@/shared/utils/list.utils';
import { AppHistoryPoint, AppMonitoringHistory, AppVolumeHistory } from '@/shared/model/app-monitoring-history.model';
import { AppVolumeIdentityUtils } from '@/shared/utils/app-volume-identity.utils';
import appVolumeFilesystemService from './app-volume-filesystem.service';
import scheduleService from './schedule.service';

type VolumeSample = Prisma.AppVolumeMonitoringSampleCreateManyInput & { id: string };

const { COLLECTION_INTERVAL_MINUTES, COLLECTION_INTERVAL_MS, GAP_THRESHOLD_MS } = MonitoringHistoryUtils;

class AppMonitoringHistoryService {
  private running = false;

  initialize() {
    scheduleService.scheduleJob('app-monitoring-history', `*/${COLLECTION_INTERVAL_MINUTES} * * * *`, () => {
      void this.collect();
    });
    void this.collect();
  }

  async getPopulation() {
    const [apps, volumes] = await Promise.all([
      dataAccess.client.app.findMany({ select: { id: true, projectId: true } }),
      dataAccess.client.appVolume.findMany({ include: { app: { select: { projectId: true } } } })
    ]);
    return { apps, volumes };
  }

  async getRawHistory(appIds: string[], cutoff: Date) {
    return Promise.all([
      dataAccess.client.monitoringSample.findMany({
        where: { appId: { in: appIds }, sampledAt: { gte: cutoff } },
        select: { id: true, appId: true, sampledAt: true, cpuCores: true, ramBytes: true, measuredAt: true },
        orderBy: { sampledAt: 'asc' }
      }),
      dataAccess.client.appVolumeMonitoringMembership
        .findMany({
          where: { volume: { appId: { in: appIds } }, sample: { sampledAt: { gte: cutoff } } },
          include: { sample: true, volume: { select: { appId: true, sharedVolumeId: true, containerMountPath: true, app: { select: { projectId: true } } } } },
          orderBy: { sample: { sampledAt: 'asc' } }
        })
        .then((items) => items.map((item) => ({ ...item.sample, volumeId: item.volumeId, volume: item.volume })))
    ]);
  }

  async save(
    apps: Prisma.MonitoringSampleCreateManyInput[],
    volumes: Prisma.AppVolumeMonitoringSampleCreateManyInput[],
    memberships: Prisma.AppVolumeMonitoringMembershipCreateManyInput[],
    cutoff: Date
  ) {
    await dataAccess.client.$transaction(async (tx) => {
      await monitoringHistoryService.saveSamples(tx, apps, cutoff);
      for (const chunk of ListUtils.chunk(volumes, 100)) {
        await tx.appVolumeMonitoringSample.createMany({ data: chunk });
      }
      for (const chunk of ListUtils.chunk(memberships, 100)) {
        await tx.appVolumeMonitoringMembership.createMany({ data: chunk });
      }
      await tx.appVolumeMonitoringSample.deleteMany({ where: { sampledAt: { lt: cutoff } } });
    });
  }

  async getHistory(appIds: string[]): Promise<AppMonitoringHistory> {
    const retention = await monitoringHistoryService.getRetentionHours();
    const [apps, volumes] = await this.getRawHistory(appIds, new Date(Date.now() - retention * 3600_000));
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
      if (points.length && time - points[points.length - 1].time > GAP_THRESHOLD_MS) {
        points.push({
          time: points[points.length - 1].time + COLLECTION_INTERVAL_MS,
          isGap: true,
          cpuCores: null,
          ramBytes: null,
          storageBytes: null,
          availableVolumes: 0,
          unavailableVolumes: 0
        });
      }
      const currentApps = appsByTime.get(time) ?? [];
      const currentVolumes = volumesByTime.get(time) ?? [];
      const uniqueVolumes = new Map<string, (typeof currentVolumes)[number]>();
      for (const item of currentVolumes) {
        const key = AppVolumeIdentityUtils.key(item.volume.app.projectId, item.volumeId, item.volume.sharedVolumeId);
        if (!uniqueVolumes.has(key) || item.status === 'available') {
          uniqueVolumes.set(key, item);
        }
        let series = volumeSeries.get(item.volumeId);
        if (!series) {
          series = { id: item.volumeId, label: item.volume.containerMountPath, points: [] };
          volumeSeries.set(item.volumeId, series);
        }
        if (series.points.length && time - series.points[series.points.length - 1].time > GAP_THRESHOLD_MS) {
          series.points.push({ time: series.points[series.points.length - 1].time + COLLECTION_INTERVAL_MS, usedBytes: null, measuredAt: null });
        }
        series.points.push({ time, usedBytes: item.status === 'available' ? item.usedBytes : null, measuredAt: item.measuredAt?.getTime() ?? null });
      }
      if (currentApps.length && currentApps.every((item) => item.cpuCores !== null && item.measuredAt)) {
        latestCpuMeasurement = Math.max(latestCpuMeasurement ?? 0, Math.min(...currentApps.map((item) => item.measuredAt!.getTime())));
      }
      if (currentApps.length && currentApps.every((item) => item.ramBytes !== null && item.measuredAt)) {
        latestRamMeasurement = Math.max(latestRamMeasurement ?? 0, Math.min(...currentApps.map((item) => item.measuredAt!.getTime())));
      }
      const available = [...uniqueVolumes.values()].filter((item) => item.status === 'available' && item.usedBytes !== null);
      if (available.length && available.every((item) => item.measuredAt)) {
        latestVolumeMeasurement = Math.max(latestVolumeMeasurement ?? 0, Math.min(...available.map((item) => item.measuredAt!.getTime())));
      }
      points.push({
        time,
        cpuCores: currentApps.length && currentApps.every((item) => item.cpuCores !== null) ? currentApps.reduce((sum, item) => sum + item.cpuCores!, 0) : null,
        ramBytes: currentApps.length && currentApps.every((item) => item.ramBytes !== null) ? currentApps.reduce((sum, item) => sum + item.ramBytes!, 0) : null,
        storageBytes: available.length ? available.reduce((sum, item) => sum + item.usedBytes!, 0) : null,
        availableVolumes: available.length,
        unavailableVolumes: uniqueVolumes.size - available.length
      });
    }
    const now = Date.now();
    const lastPoint = points.at(-1);
    if (lastPoint && now - lastPoint.time > GAP_THRESHOLD_MS) {
      points.push({ time: now, isGap: true, cpuCores: null, ramBytes: null, storageBytes: null, availableVolumes: 0, unavailableVolumes: 0 });
    }
    for (const volume of volumeSeries.values()) {
      const lastSample = volume.points.at(-1);
      if (lastSample && now - lastSample.time > GAP_THRESHOLD_MS) {
        volume.points.push({ time: now, usedBytes: null, measuredAt: null });
      }
    }
    return { retentionHours: retention, points, volumes: [...volumeSeries.values()], latestCpuMeasurement, latestRamMeasurement, latestVolumeMeasurement };
  }

  async getRetentionHours() {
    return monitoringHistoryService.getRetentionHours();
  }

  async setRetentionHours(hours: number) {
    await monitoringHistoryService.setRetentionHours(hours);
  }

  async collect() {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      const sampledAt = new Date();
      const { apps, volumes } = await this.getPopulation();
      const [metrics, filesystem, retention] = await Promise.all([
        appHistoryService.getAppMetrics(apps).catch((error) => {
          console.error('App metrics collection failed', error);
          return new Map();
        }),
        appVolumeFilesystemService.getVolumeFilesystemUsage(volumes.map((volume) => ({ ...volume, projectId: volume.app.projectId }))).catch((error) => {
          console.error('Volume metrics collection failed', error);
          return new Map();
        }),
        monitoringHistoryService.getRetentionHours()
      ]);
      const samples = new Map<string, VolumeSample>();
      const memberships: Prisma.AppVolumeMonitoringMembershipCreateManyInput[] = [];
      for (const volume of volumes) {
        const underlyingId = AppVolumeIdentityUtils.underlyingId(volume.id, volume.sharedVolumeId);
        const identity = AppVolumeIdentityUtils.key(volume.app.projectId, volume.id, volume.sharedVolumeId);
        let sample = samples.get(identity);
        if (!sample) {
          const usage = filesystem.get(volume.id);
          sample = {
            id: randomUUID(),
            volumeId: underlyingId,
            sampledAt,
            status: usage?.status ?? 'unavailable',
            usedBytes: usage?.usedBytes ?? null,
            availableBytes: usage?.availableBytes ?? null,
            capacityBytes: usage?.capacityBytes ?? null,
            measuredAt: usage?.measuredAt ? new Date(usage.measuredAt) : null
          };
          samples.set(identity, sample);
        }
        memberships.push({ sampleId: sample.id, volumeId: volume.id });
      }
      await this.save(
        apps.map((app) => ({
          appId: app.id,
          sampledAt,
          cpuCores: metrics.get(app.id)?.cpuCores ?? null,
          ramBytes: metrics.get(app.id)?.ramBytes ?? null,
          measuredAt: metrics.get(app.id)?.measuredAt ?? null
        })),
        [...samples.values()],
        memberships,
        new Date(sampledAt.getTime() - retention * 60 * 60 * 1000)
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
