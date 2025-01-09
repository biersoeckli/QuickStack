import dataAccess from "../../adapter/db.client";
import { ServiceException } from "../../../shared/model/service.exception.model";
import { PathUtils } from "../../utils/path.utils";
import { FsUtils } from "../../utils/fs.utils";
import s3Service from "../aws-s3.service";
import scheduleService from "./schedule.service";
import standalonePodService from "./standalone-pod.service";
import { ListUtils } from "../../../shared/utils/list.utils";
import { S3Target, VolumeBackup } from "@prisma/client";
import { BackupEntry, BackupInfoModel } from "../../../shared/model/backup-info.model";

const s3BucketPrefix = 'quickstack-backups';

class BackupService {

    folderPathForVolumeBackup(appId: string, backupVolumeId: string) {
        return `${s3BucketPrefix}/${appId}/${backupVolumeId}`;
    }

    async registerAllBackups() {
        const allVolumeBackups = await dataAccess.client.volumeBackup.findMany();
        console.log(`Deregistering existing backup schedules...`);
        this.unregisterAllBackups();

        console.log(`Registering ${allVolumeBackups.length} backup schedules...`);
        const groupedByCron = ListUtils.groupBy(allVolumeBackups, vb => vb.cron);

        for (const [cron, volumeBackups] of Array.from(groupedByCron.entries())) {
            scheduleService.scheduleJob(cron, cron, async () => {
                console.log(`Running backup for ${volumeBackups.length} volumes...`);
                for (const volumeBackup of volumeBackups) {
                    try {
                        await this.runBackupForVolume(volumeBackup.id);
                    } catch (e) {
                        console.error(`Error during backup for volume ${volumeBackup.volumeId} and backup ${volumeBackup.id}`);
                        console.error(e);
                    }
                }
                console.log(`Backup for ${volumeBackups.length} volumes finished.`);
            });
        }
    }

    async unregisterAllBackups() {
        const allJobs = scheduleService.getAlJobs();
        for (const jobName of allJobs) {
            scheduleService.cancelJob(jobName);
        }
    }

    async getBackupsForAllS3Targets() {
        const s3Targets = await dataAccess.client.s3Target.findMany();
        const returnValFromAllS3Targets = await Promise.all(s3Targets.map(s3Target =>
            this.getBackupsFromS3Target(s3Target)));

        const backupInfoModels = returnValFromAllS3Targets.map(x => x.backupInfoModels).flat();
        backupInfoModels.sort((a, b) => {
            if (a.projectName === b.projectName) {
                return a.appName.localeCompare(b.appName);
            }
            return a.projectName.localeCompare(b.projectName);
        });

        const backupsVolumesWithoutActualBackups = returnValFromAllS3Targets.map(x => x.backupsVolumesWithoutActualBackups).flat();
        return {
            backupInfoModels,
            backupsVolumesWithoutActualBackups
        };
    }

    async getBackupsFromS3Target(s3Target: S3Target) {

        const defaultInfoIfAppWasDeleted = 'orphaned';

        const volumeBackups = await dataAccess.client.volumeBackup.findMany({
            include: {
                volume: {
                    include: {
                        app: {
                            include: {
                                project: true
                            }
                        }
                    }
                },
                target: true
            }
        });

        const backupData = await this.listAndParseBackupFiles(s3Target);

        const groupedBackupInfo = ListUtils.groupBy(backupData, x => x.backupVolumeId);

        const backupInfoModels: BackupInfoModel[] = [];

        for (let [backupVolumeId, backups] of Array.from(groupedBackupInfo.entries())) {
            const volumeBackup = volumeBackups.find(vb => vb.id === backupVolumeId);

            const backupEntries: BackupEntry[] = backups.map(b => ({
                backupDate: b.backupDate,
                key: b.key ?? '',
                sizeBytes: b.sizeBytes
            }));

            backupEntries.sort((a, b) => b.backupDate.getTime() - a.backupDate.getTime());


            backupInfoModels.push({
                projectId: volumeBackup?.volume.app.projectId ?? defaultInfoIfAppWasDeleted,
                projectName: volumeBackup?.volume.app.project.name ?? defaultInfoIfAppWasDeleted,
                appName: volumeBackup?.volume.app.name ?? defaultInfoIfAppWasDeleted,
                appId: backups[0].appId,
                backupVolumeId: backups[0].backupVolumeId,
                backupRetention: volumeBackup?.retention ?? 0,
                volumeId: volumeBackup?.id ?? defaultInfoIfAppWasDeleted,
                mountPath: volumeBackup?.volume.containerMountPath ?? defaultInfoIfAppWasDeleted,
                backups: backupEntries
            });
        }

        const backupsVolumesWithoutActualBackups = volumeBackups.filter(vb => !backupInfoModels.find(x => x.backupVolumeId === vb.id));

        backupInfoModels.sort((a, b) => {
            if (a.projectName === b.projectName) {
                return a.appName.localeCompare(b.appName);
            }
            return a.projectName.localeCompare(b.projectName);
        });

        return { backupInfoModels, backupsVolumesWithoutActualBackups };
    }

    private async listAndParseBackupFiles(s3Target: { id: string; createdAt: Date; updatedAt: Date; name: string; bucketName: string; endpoint: string; region: string; accessKeyId: string; secretKey: string; }) {
        const fileKeys = await s3Service.listFiles(s3Target);
        const backupData = fileKeys.filter(x => {
            if (!x.Key) {
                return false;
            }
            return x.Key.startsWith(s3BucketPrefix);
        }).map(fileKey => {
            try {
                const splittedKey = fileKey.Key?.split('/');
                if (!splittedKey || splittedKey.length < 3) {
                    return undefined;
                }
                const appId = splittedKey[1];
                const backupVolumeId = splittedKey[2];
                const backupDate = new Date(splittedKey[3].replace('.tar.gz', ''));
                return {
                    appId,
                    backupVolumeId,
                    backupDate,
                    key: fileKey.Key,
                    sizeBytes: fileKey.Size
                };
            } catch (e) {
                console.error(`Error during read information for backup for key ${fileKey}`);
                console.error(e);
            }
        }).filter(x => !!x);
        return backupData;
    }

    async runBackupForVolume(backupVolumeId: string) {
        console.log(`Running backup for backupVolume ${backupVolumeId}`);

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

        const pod = await standalonePodService.getPodsForApp(projectId, appId);
        if (pod.length === 0) {
            throw new ServiceException(`There are no running pods for volume id ${volume.id} in app ${volume.app.id}. Make sure the app is running.`);
        }
        const firstPod = pod[0];

        // zipping and saving backup data in quickstack pod
        const downloadPath = PathUtils.backupVolumeDownloadZipPath(backupVolume.id);
        await FsUtils.createDirIfNotExistsAsync(PathUtils.tempBackupDataFolder, true);

        try {
            console.log(`Downloading data from pod ${firstPod.podName} ${volume.containerMountPath} to ${downloadPath}`);
            await standalonePodService.cpFromPod(projectId, firstPod.podName, firstPod.containerName, volume.containerMountPath, downloadPath);

            // upload backup
            console.log(`Uploading backup to S3`);
            const now = new Date();
            const nowString = now.toISOString();
            await s3Service.uploadFile(backupVolume.target, downloadPath,
                `${this.folderPathForVolumeBackup(appId, backupVolumeId)}/${nowString}.tar.gz`, 'application/gzip', 'binary');


            // delete files wich are nod needed anymore (by retention)
            console.log(`Deleting old backups`);
            const files = await s3Service.listFiles(backupVolume.target);

            const filesFromThisBackup = files.filter(f => f.Key?.startsWith(`${this.folderPathForVolumeBackup(appId, backupVolumeId)}/`)).map(f => ({
                date: new Date((f.Key ?? '')
                    .replace(`${this.folderPathForVolumeBackup(appId, backupVolumeId)}/`, '')
                    .replace('.tar.gz', '')),
                key: f.Key
            })).filter(f => !isNaN(f.date.getTime()) && !!f.key);

            filesFromThisBackup.sort((a, b) => a.date.getTime() - b.date.getTime());

            const filesToDelete = filesFromThisBackup.slice(0, -backupVolume.retention);
            for (const file of filesToDelete) {
                console.log(`Deleting backup ${file.key}`);
                await s3Service.deleteFile(backupVolume.target, file.key!);
            }
            console.log(`Backup finished for volume ${volume.id} and backup ${backupVolume.id}`);
        } finally {
            await FsUtils.deleteFileIfExists(downloadPath);
        }
    }
}

const backupService = new BackupService();
export default backupService;
