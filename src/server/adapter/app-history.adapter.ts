import { Prisma } from '@prisma/client';
import dataAccess from '@/server/adapter/db.client';
import { Constants } from '@/shared/utils/constants';

class AppHistoryAdapter {
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

}

const appHistoryAdapter = new AppHistoryAdapter();
export default appHistoryAdapter;
