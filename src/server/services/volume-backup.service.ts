import { revalidateTag, unstable_cache } from "next/cache";
import dataAccess from "../adapter/db.client";
import { Tags } from "../utils/cache-tag-generator.utils";
import { Prisma, VolumeBackup } from "@prisma/client";
import { VolumeBackupExtendedModel } from "@/shared/model/volume-backup-extended.model";
import podService from "./pod.service";
import { ServiceException } from "@/shared/model/service.exception.model";
import { PathUtils } from "../utils/path.utils";
import { FsUtils } from "../utils/fs.utils";
import s3Service from "./aws-s3.service";

class VolumeBackupService {

    async createBackupForVolume(backupVolumeId: string) {

        const backupVolume = await dataAccess.client.volumeBackup.findFirstOrThrow({
            where: {
                id: backupVolumeId
            },
            include: {
                volume: {
                    include: {
                        app: true
                    }
                },
                target: true
            }
        });

        const projectId = backupVolume.volume.app.projectId;
        const appId = backupVolume.volume.app.id;
        const volume = backupVolume.volume;

        const pod = await podService.getPodsForApp(projectId, appId);
        if (pod.length === 0) {
            throw new ServiceException(`There are no running pods for volume id ${volume.id} in app ${volume.app.id}. Make sure the app is running.`);
        }
        const firstPod = pod[0];

        // zipping and saving backup data in quickstack pod
        const downloadPath = PathUtils.backupVolumeDownloadZipPath(backupVolume.id);
        await FsUtils.createDirIfNotExistsAsync(PathUtils.tempBackupDataFolder, true);

        try {
            console.log(`Downloading data from pod ${firstPod.podName} ${volume.containerMountPath} to ${downloadPath}`);
            await podService.cpFromPod(projectId, firstPod.podName, firstPod.containerName, volume.containerMountPath, downloadPath);

            // uploac backup
            console.log(`Uploading backup to S3`);
            const now = new Date();
            const nowString = now.toISOString();
            await s3Service.uploadFile(backupVolume.target, downloadPath,
                `${appId}/${volume.id}/${nowString}.tar.gz`, 'application/gzip', 'binary');


            // delete files wich are nod needed anymore (by retention)
            console.log(`Deleting old backups`);
            const files = await s3Service.listFiles(backupVolume.target);

            const filesFromThisBackup = files.filter(f => f.Key?.startsWith(`${appId}/${volume.id}/`)).map(f => ({
                date: new Date((f.Key ?? '')
                    .replace(`${appId}/${volume.id}/`, '')
                    .replace('.tar.gz', '')),
                key: f.Key
            })).filter(f => !isNaN(f.date.getTime()) && !!f.key);
            console.log(filesFromThisBackup)

            filesFromThisBackup.sort((a, b) => a.date.getTime() - b.date.getTime());

            const filesToDelete = filesFromThisBackup.slice(0, -backupVolume.retention);
            for (const file of filesToDelete) {
                console.log(`Deleting backup ${file.key}`);
                await s3Service.deleteFile(backupVolume.target, file.key!);
            }
            console.log(`Backup finished for volume ${volume.id}`);
        } finally {
            await FsUtils.deleteFileIfExists(downloadPath);
        }
    }

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
        return await unstable_cache(() => dataAccess.client.volumeBackup.findMany({
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
        })();
    }

    async getById(id: string) {
        return dataAccess.client.volumeBackup.findFirstOrThrow({
            where: {
                id
            }
        });
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
}

const volumeBackupService = new VolumeBackupService();
export default volumeBackupService;
