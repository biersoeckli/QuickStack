import dataAccess from "../../adapter/db.client";
import { ServiceException } from "../../../shared/model/service.exception.model";
import { PathUtils } from "../../utils/path.utils";
import { FsUtils } from "../../utils/fs.utils";
import s3Service from "../aws-s3.service";
import scheduleService from "./schedule.service";
import standalonePodService from "./standalone-pod.service";
import { ListUtils } from "../../../shared/utils/list.utils";

class BackupService {

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

            // uploac backup
            console.log(`Uploading backup to S3`);
            const now = new Date();
            const nowString = now.toISOString();
            await s3Service.uploadFile(backupVolume.target, downloadPath,
                `${appId}/${backupVolumeId}/${nowString}.tar.gz`, 'application/gzip', 'binary');


            // delete files wich are nod needed anymore (by retention)
            console.log(`Deleting old backups`);
            const files = await s3Service.listFiles(backupVolume.target);

            const filesFromThisBackup = files.filter(f => f.Key?.startsWith(`${appId}/${backupVolumeId}/`)).map(f => ({
                date: new Date((f.Key ?? '')
                    .replace(`${appId}/${backupVolumeId}/`, '')
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