import { S3Target } from "@prisma/client";
import s3Service from "../../aws-s3.service";
import { Constants } from "@/shared/utils/constants";
import k3s from "../../../adapter/kubernetes-api.adapter";
import podService from "../../pod.service";
import stream from "stream";
import { PodsInfoModel } from "../../../../shared/model/pods-info.model";
import { ServiceException } from "../../../../shared/model/service.exception.model";

export const BACKUP_NAMESPACE = Constants.QS_NAMESPACE;
export const s3BucketPrefix = 'quickstack-backups';

class SharedBackupService {

    folderPathForVolumeBackup(appId: string, backupVolumeId: string) {
        return `${s3BucketPrefix}/${appId}/${backupVolumeId}`;
    }

    async deleteOldBackupsBasedOnRetention(
        s3Target: S3Target,
        appId: string,
        backupVolumeId: string,
        retention: number,
        fileExtension: string = '.tar.gz'
    ) {
        console.log(`Deleting old backups`);
        const files = await s3Service.listFiles(s3Target);

        const filesFromThisBackup = files
            .filter(f => f.Key?.startsWith(`${this.folderPathForVolumeBackup(appId, backupVolumeId)}/`))
            .map(f => ({
                date: new Date((f.Key ?? '')
                    .replace(`${this.folderPathForVolumeBackup(appId, backupVolumeId)}/`, '')
                    .replace(fileExtension, '')),
                key: f.Key
            }))
            .filter(f => !isNaN(f.date.getTime()) && !!f.key);

        filesFromThisBackup.sort((a, b) => a.date.getTime() - b.date.getTime());

        const filesToDelete = filesFromThisBackup.slice(0, -retention);
        for (const file of filesToDelete) {
            console.log(`Deleting backup ${file.key}`);
            await s3Service.deleteFile(s3Target, file.key!);
        }
    }

    async logDatabaseBackupOutput(jobName: string, namespace?: string): Promise<void> {
        const pod = await this.getPodForBackupJob(jobName, namespace);
        await podService.waitUntilPodIsRunningFailedOrSucceded(namespace || BACKUP_NAMESPACE, pod.podName);

        const logStream = new stream.PassThrough();

        const k3sStreamRequest = await k3s.log.log(namespace || BACKUP_NAMESPACE, pod.podName, pod.containerName, logStream, {
            follow: true,
            tailLines: undefined,
            timestamps: true,
            pretty: false,
            previous: false
        });

        logStream.on('data', async (chunk) => {
            console.log(chunk.toString()); // TODO: In the future this should be written into a file so that users can view it in a more friendly way
        });

        logStream.on('error', async (error) => {
            console.error('[ERROR] An unexpected error occurred while streaming backup logs.');
            console.error(error);
        });

        logStream.on('end', async () => {
            console.log(`[END] Log stream ended for backup job: ${jobName}`);
        });
    }

    async getPodForBackupJob(jobName: string, namespace?: string): Promise<PodsInfoModel> {
        const res = await k3s.core.listNamespacedPod(namespace || BACKUP_NAMESPACE, undefined, undefined, undefined, undefined, `job-name=${jobName}`);
        const pods = res.body.items;
        if (pods.length === 0) {
            throw new ServiceException(`No pod found for backup job ${jobName}`);
        }
        const pod = pods[0];
        return {
            podName: pod.metadata?.name!,
            containerName: pod.spec?.containers?.[0].name!
        } as PodsInfoModel;
    }

    async waitForBackupJobCompletion(jobName: string, namespace?: string): Promise<void> {
        const POLL_INTERVAL = 10000; // 10 seconds
        return await new Promise<void>((resolve, reject) => {
            const intervalId = setInterval(async () => {
                try {
                    const job = await k3s.batch.readNamespacedJob(jobName, namespace || BACKUP_NAMESPACE);
                    const status = job.body.status;

                    if ((status?.succeeded ?? 0) > 0) {
                        clearInterval(intervalId);
                        console.log(`Backup job ${jobName} completed successfully`);
                        resolve();
                    } else if ((status?.failed ?? 0) > 0) {
                        clearInterval(intervalId);
                        const errorMessage = `Backup job ${jobName} failed`;
                        console.error(errorMessage);
                        reject(new ServiceException(errorMessage));
                    }
                } catch (err) {
                    clearInterval(intervalId);
                    console.error(`Error checking backup job status: ${err}`);
                    reject(err);
                }
            }, POLL_INTERVAL);
        });
    }
}

const sharedBackupService = new SharedBackupService();
export default sharedBackupService;