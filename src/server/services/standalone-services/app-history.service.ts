import { Prisma } from '@prisma/client';
import dataAccess from '@/server/adapter/db.client';
import { Constants } from '@/shared/utils/constants';
import { quantityToScalar } from '@kubernetes/client-node/dist/util.js';
import metricsAdapter from '@/server/adapter/app-history-metrics.adapter';

type App = { id: string; projectId: string };
type Measurement = { cpuCores: number | null; ramBytes: number | null; measuredAt: Date | null };

class AppHistoryService {
    async getPopulation() {
        const [apps, volumes] = await Promise.all([
            dataAccess.client.app.findMany({ select: { id: true, projectId: true } }),
            dataAccess.client.appVolume.findMany({ include: { app: { select: { projectId: true } } } }),
        ]);
        return { apps, volumes };
    }

    async getRetentionHours() {
        const value = (await dataAccess.client.parameter.findUnique({ where: { name: Constants.APP_MONITORING_HISTORY_RETENTION_HOURS } }))?.value;
        const hours = Number(value);
        return Number.isInteger(hours) && hours >= 1 && hours <= 168 ? hours : 24;
    }

    async setRetentionHours(hours: number) {
        await dataAccess.client.parameter.upsert({
            where: { name: Constants.APP_MONITORING_HISTORY_RETENTION_HOURS },
            create: { name: Constants.APP_MONITORING_HISTORY_RETENTION_HOURS, value: String(hours) },
            update: { value: String(hours) },
        });
    }

    async save(apps: Prisma.AppMonitoringSampleCreateManyInput[], volumes: Prisma.AppVolumeMonitoringSampleCreateManyInput[], memberships: Prisma.AppVolumeMonitoringMembershipCreateManyInput[], cutoff: Date) {
        await dataAccess.client.$transaction(async tx => {
            for (let i = 0; i < apps.length; i += 100) await tx.appMonitoringSample.createMany({ data: apps.slice(i, i + 100) });
            for (let i = 0; i < volumes.length; i += 100) await tx.appVolumeMonitoringSample.createMany({ data: volumes.slice(i, i + 100) });
            for (let i = 0; i < memberships.length; i += 100) await tx.appVolumeMonitoringMembership.createMany({ data: memberships.slice(i, i + 100) });
            await tx.appMonitoringSample.deleteMany({ where: { sampledAt: { lt: cutoff } } });
            await tx.appVolumeMonitoringSample.deleteMany({ where: { sampledAt: { lt: cutoff } } });
        });
    }

    async getHistory(appIds: string[], cutoff: Date) {
        return Promise.all([
            dataAccess.client.appMonitoringSample.findMany({ where: { appId: { in: appIds }, sampledAt: { gte: cutoff } }, orderBy: { sampledAt: 'asc' } }),
            dataAccess.client.appVolumeMonitoringMembership.findMany({
                where: { volume: { appId: { in: appIds } }, sample: { sampledAt: { gte: cutoff } } },
                include: {
                    sample: true,
                    volume: { select: { appId: true, sharedVolumeId: true, containerMountPath: true, app: { select: { projectId: true } } } },
                },
                orderBy: { sample: { sampledAt: 'asc' } },
            }).then(memberships => memberships.map(item => ({ ...item.sample, volumeId: item.volumeId, volume: item.volume }))),
        ]);
    }

    async getAppMetrics(apps: App[]): Promise<Map<string, Measurement>> {
        const [pods, metrics] = await Promise.all([metricsAdapter.getPods(), metricsAdapter.getMetrics()]);
        const metricsByPod = new Map(metrics.map(metric => [`${metric.metadata.namespace}/${metric.metadata.name}`, metric]));
        const podsByApp = new Map<string, typeof pods>();
        for (const pod of pods) {
            const appId = pod.metadata?.labels?.app;
            const namespace = pod.metadata?.namespace;
            if (!appId || !namespace || ['Succeeded', 'Failed'].includes(pod.status?.phase ?? '')) continue;
            const key = `${namespace}/${appId}`;
            const group = podsByApp.get(key) ?? [];
            group.push(pod);
            podsByApp.set(key, group);
        }
        const result = new Map<string, Measurement>();
        for (const app of apps) {
            const appPods = podsByApp.get(`${app.projectId}/${app.id}`) ?? [];
            let cpu = 0;
            let ram = 0;
            let cpuComplete = appPods.length > 0;
            let ramComplete = appPods.length > 0;
            let oldest = Infinity;
            for (const pod of appPods) {
                const metric = metricsByPod.get(`${app.projectId}/${pod.metadata?.name}`);
                const timestamp = Date.parse(metric?.timestamp ?? '');
                if (!metric || !Number.isFinite(timestamp) || Date.now() - timestamp > 5 * 60_000 || timestamp - Date.now() > 60_000) {
                    cpuComplete = false;
                    ramComplete = false;
                    continue;
                }
                oldest = Math.min(oldest, timestamp);
                if (!pod.spec?.containers?.length) {
                    cpuComplete = false;
                    ramComplete = false;
                    continue;
                }
                for (const container of pod.spec.containers) {
                    const usage = metric.containers.find(item => item.name === container.name)?.usage;
                    for (const kind of ['cpu', 'memory'] as const) {
                        let value = NaN;
                        try {
                            if (usage?.[kind]) value = Number(quantityToScalar(usage[kind]));
                        } catch { /* Invalid quantities are gaps. */ }
                        if (!Number.isFinite(value) || value < 0) {
                            if (kind === 'cpu') cpuComplete = false;
                            else ramComplete = false;
                        } else if (kind === 'cpu') cpu += value;
                        else ram += value;
                    }
                }
            }
            result.set(app.id, { cpuCores: cpuComplete ? cpu : null, ramBytes: ramComplete ? ram : null, measuredAt: (cpuComplete || ramComplete) && Number.isFinite(oldest) ? new Date(oldest) : null });
        }
        return result;
    }
}

const appHistoryService = new AppHistoryService();
export default appHistoryService;
