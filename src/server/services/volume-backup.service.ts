import { revalidateTag, unstable_cache } from "next/cache";
import dataAccess from "../adapter/db.client";
import { Tags } from "../utils/cache-tag-generator.utils";
import { Prisma, VolumeBackup } from "@prisma/client";
import { VolumeBackupExtendedModel } from "@/shared/model/volume-backup-extended.model";
import { AppExtendedModel } from "@/shared/model/app-extended.model";
import { ServiceException } from "@/shared/model/service.exception.model";
import { dlog } from "./deployment-logs.service";
import networkPolicyService from "./network-policy.service";
import backupService from "./standalone-services/backup.service";

class VolumeBackupService {

    async getAll(): Promise<VolumeBackupExtendedModel[]> {
        return await unstable_cache(() => dataAccess.client.volumeBackup.findMany({
            orderBy: {
                cron: 'asc'
            },
            include: {
                target: true
            }
        }),
            [Tags.volumeBackups()], {
            tags: [Tags.volumeBackups()]
        })();
    }

    async getForApp(appId: string): Promise<VolumeBackupExtendedModel[]> {
        return await unstable_cache((appId: string) => dataAccess.client.volumeBackup.findMany({
            where: {
                volume: {
                    appId
                }
            },
            include: {
                target: true
            },
            orderBy: {
                cron: 'asc'
            }
        }),
            [Tags.volumeBackups()], {
            tags: [Tags.volumeBackups()]
        })(appId);
    }

    async getById(id: string) {
        return dataAccess.client.volumeBackup.findFirstOrThrow({
            where: {
                id
            }
        });
    }

    async getAppIdById(id: string) {
        const volumeBackup = await dataAccess.client.volumeBackup.findFirstOrThrow({
            where: { id },
            select: {
                volume: {
                    select: { appId: true },
                },
            },
        });
        return volumeBackup.volume.appId;
    }

    async save(item: Prisma.VolumeBackupUncheckedCreateInput | Prisma.VolumeBackupUncheckedUpdateInput) {
        let savedItem: VolumeBackup;
        try {
            if (item.id) {
                savedItem = await dataAccess.client.volumeBackup.update({
                    where: {
                        id: item.id as string
                    },
                    data: item,
                });
            } else {
                savedItem = await dataAccess.client.volumeBackup.create({
                    data: item as Prisma.VolumeBackupUncheckedCreateInput,
                });
            }
        } finally {
            revalidateTag(Tags.volumeBackups());
        }
        return savedItem;
    }

    async deleteById(id: string) {
        const existingItem = await this.getById(id);
        if (!existingItem) {
            return;
        }
        try {
            await dataAccess.client.volumeBackup.delete({
                where: {
                    id
                }
            });
        } finally {
            revalidateTag(Tags.volumeBackups());
        }
    }

    /**
     * Runs the backups that opted in for automatic pre-deployment execution.
     *
     * A backup schedule opts in with `backupBeforeDeployment`. Participating
     * schedules are the ones of the deployed app itself and of every app that
     * is directly connected to it through the app network policy (1 hop, both
     * directions, same project). Backups run one after another. A backup that
     * fails aborts the deployment unless it is marked `failSilently`.
     */
    async runBackupsBeforeDeployment(deploymentId: string, app: AppExtendedModel) {
        const backupsToRun = await this.getBackupsToRunBeforeDeployment(app);
        if (backupsToRun.length === 0) {
            return;
        }

        await dlog(deploymentId, `Running ${backupsToRun.length} automatic backup(s) before deployment...`);

        let abortDeployment = false;
        let successfullBackupsCount = 0;
        for (const backup of backupsToRun) {
            const label = `app "${backup.volume.app.name}" volume "${backup.volume.containerMountPath}"`;
            try {
                await dlog(deploymentId, `Starting automatic backup before deployment for ${label}...`);
                await backupService.runBackupForSchedule(backup.id);
                await dlog(deploymentId, `✓ Automatic backup finished for ${label}.`);
                successfullBackupsCount++;
            } catch (e) {
                const message = e instanceof Error ? e.message : String(e);
                await dlog(deploymentId, `[Error] Automatic backup failed for ${label}: ${message}`);
                if (!backup.failSilently) {
                    abortDeployment = true;
                }
            }
        }

        if (abortDeployment) {
            throw new ServiceException('Deployment aborted because an automatic pre-deployment backup failed. Enable "fail silently" on the backup schedule to continue anyway.');
        }
        await dlog(deploymentId, `Successfully created ${successfullBackupsCount} backups before deployment`);
    }

    private async getBackupsToRunBeforeDeployment(app: AppExtendedModel) {
        const connectedAppIds = await networkPolicyService.getDirectlyConnectedAppIds(app);
        const appIds = [app.id, ...connectedAppIds];

        return dataAccess.client.volumeBackup.findMany({
            where: {
                backupBeforeDeployment: true,
                volume: {
                    appId: { in: appIds },
                },
            },
            include: {
                volume: {
                    include: { app: true },
                },
            },
            orderBy: { createdAt: 'asc' },
        });
    }
}

const volumeBackupService = new VolumeBackupService();
export default volumeBackupService;
