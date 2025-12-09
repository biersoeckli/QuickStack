import k3s from "../../../adapter/kubernetes-api.adapter";
import { V1Job } from "@kubernetes/client-node";
import { Constants } from "../../../../shared/utils/constants";
import { AppTemplateUtils } from "../../../utils/app-template.utils";
import { KubeObjectNameUtils } from "../../../utils/kube-object-name.utils";
import namespaceService from "../../namespace.service";
import sharedBackupService, { BACKUP_NAMESPACE } from "./shared-backup.service";


class MongoDbBackupService {

    async backupMongoDb(backupVolumeId: string, backupVolume: any, app: any) {
        await namespaceService.createNamespaceIfNotExists(BACKUP_NAMESPACE);

        const jobName = KubeObjectNameUtils.addRandomSuffix(`backup-mongodb-${app.id}`);
        console.log(`Creating MongoDB backup job with name: ${jobName}`);

        // Get database credentials
        const dbInfo = AppTemplateUtils.getDatabaseModelFromApp(app);

        // Build MongoDB connection URI with authentication
        const mongodbUri = `mongodb://${dbInfo.username}:${dbInfo.password}@${dbInfo.hostname}:${dbInfo.port}/?authSource=admin`;

        // Generate S3 key for backup
        const now = new Date();
        const nowString = now.toISOString();
        const s3Key = `${sharedBackupService.folderPathForVolumeBackup(app.id, backupVolumeId)}/${nowString}.zip`;

        console.log(`MongoDB URI: ${mongodbUri.replace(dbInfo.password, '***')}`);
        console.log(`S3 Key: ${s3Key}`);

        const jobDefinition: V1Job = {
            apiVersion: "batch/v1",
            kind: "Job",
            metadata: {
                name: jobName,
                namespace: BACKUP_NAMESPACE,
                annotations: {
                    [Constants.QS_ANNOTATION_APP_ID]: app.id,
                    [Constants.QS_ANNOTATION_PROJECT_ID]: app.projectId,
                }
            },
            spec: {
                ttlSecondsAfterFinished: 86400, // 1 day
                template: {
                    spec: {
                        containers: [
                            {
                                name: jobName,
                                image: "quickstack/job-backup-mongodb:canary",
                                env: [
                                    {
                                        name: "MONGODB_URI",
                                        value: mongodbUri
                                    },
                                    {
                                        name: "S3_ENDPOINT",
                                        value: backupVolume.target.endpoint
                                    },
                                    {
                                        name: "S3_ACCESS_KEY_ID",
                                        value: backupVolume.target.accessKeyId
                                    },
                                    {
                                        name: "S3_SECRET_KEY",
                                        value: backupVolume.target.secretKey
                                    },
                                    {
                                        name: "S3_BUCKET_NAME",
                                        value: backupVolume.target.bucketName
                                    },
                                    {
                                        name: "S3_REGION",
                                        value: backupVolume.target.region
                                    },
                                    {
                                        name: "S3_KEY",
                                        value: s3Key
                                    }
                                ]
                            }
                        ],
                        restartPolicy: "Never"
                    }
                },
                backoffLimit: 0
            }
        };

        await k3s.batch.createNamespacedJob(BACKUP_NAMESPACE, jobDefinition);
        console.log(`MongoDB backup job ${jobName} started successfully`);

        // Wait for pod to be created
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Log backup output
        await sharedBackupService.logDatabaseBackupOutput(jobName);

        // Wait for job completion
        await sharedBackupService.waitForBackupJobCompletion(jobName);

        await sharedBackupService.deleteOldBackupsBasedOnRetention(backupVolume.target, app.id, backupVolumeId, backupVolume.retention, '.zip');
        console.log(`MongoDB backup finished for volume ${backupVolume.volumeId} and backup ${backupVolume.id}`);
    }
}

const mongoDbBackupService = new MongoDbBackupService();
export default mongoDbBackupService;