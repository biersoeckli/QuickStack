import k3s from "../../../adapter/kubernetes-api.adapter";
import { V1Job } from "@kubernetes/client-node";
import { Constants } from "../../../../shared/utils/constants";
import { AppTemplateUtils } from "../../../utils/app-template.utils";
import { KubeObjectNameUtils } from "../../../utils/kube-object-name.utils";
import namespaceService from "../../namespace.service";
import sharedBackupService from "./shared-backup.service";
import { VolumeBackupExtendedModel } from "@/shared/model/volume-backup-extended.model";
import { AppExtendedModel } from "@/shared/model/app-extended.model";

class MariaDbBackupService {

    async backupMariaDb(backupVolume: VolumeBackupExtendedModel, app: AppExtendedModel) {

        const backupNamespace = app.projectId; // must run in the same namespace as the app

        await namespaceService.createNamespaceIfNotExists(backupNamespace);

        const jobName = KubeObjectNameUtils.addRandomSuffix(`backup-mysql-${app.id}`);
        console.log(`Creating MariaDB/MySQL backup job with name: ${jobName}`);

        const dbCredentials = AppTemplateUtils.getDatabaseModelFromApp(app);

        const now = new Date();
        const nowString = now.toISOString();
        const s3Key = `${sharedBackupService.folderPathForVolumeBackup(app.id, backupVolume.id)}/${nowString}.tar.gz`;

        console.log(`MariaDB/MySQL Database: ${dbCredentials.databaseName}`);
        console.log(`S3 Key: ${s3Key}`);

        const endpoint = backupVolume.target.endpoint.includes('http') ? backupVolume.target.endpoint : `https://${backupVolume.target.endpoint}`;
        console.log(`S3 Endpoint: ${endpoint}`);

        const jobDefinition: V1Job = {
            apiVersion: "batch/v1",
            kind: "Job",
            metadata: {
                name: jobName,
                namespace: backupNamespace,
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
                                image: "quickstack/job-backup-mysql:canary", // todo set to latest image once released
                                env: [
                                    {
                                        name: "MYSQL_HOST",
                                        value: dbCredentials.hostname
                                    },
                                    {
                                        name: "MYSQL_PORT",
                                        value: dbCredentials.port.toString()
                                    },
                                    {
                                        name: "MYSQL_USER",
                                        value: dbCredentials.username
                                    },
                                    {
                                        name: "MYSQL_PASSWORD",
                                        value: dbCredentials.password
                                    },
                                    {
                                        name: "MYSQL_DATABASE",
                                        value: dbCredentials.databaseName
                                    },
                                    {
                                        name: "S3_ENDPOINT",
                                        value: endpoint
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

        await k3s.batch.createNamespacedJob(backupNamespace, jobDefinition);
        console.log(`MariaDB/MySQL backup job ${jobName} started successfully`);

        // Wait for pod to be created
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Log backup output
        await sharedBackupService.logDatabaseBackupOutput(jobName, backupNamespace);

        // Wait for job completion
        await sharedBackupService.waitForBackupJobCompletion(jobName, backupNamespace);

        await sharedBackupService.deleteOldBackupsBasedOnRetention(backupVolume.target, app.id, backupVolume.id, backupVolume.retention, '.tar.gz');
        console.log(`MariaDB/MySQL backup finished for volume ${backupVolume.volumeId} and backup ${backupVolume.id}`);
    }
}

const mariaDbBackupService = new MariaDbBackupService();
export default mariaDbBackupService;
