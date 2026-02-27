import { ServiceException } from '@/shared/model/service.exception.model';
import { KubeObjectNameUtils } from '../utils/kube-object-name.utils';
import { Constants } from '@/shared/utils/constants';
import { V1Job } from '@kubernetes/client-node';
import k3s from '../adapter/kubernetes-api.adapter';
import dataAccess from '../adapter/db.client';
import deploymentService from './deployment.service';
import pvcService from './pvc.service';
import { revalidateTag } from 'next/cache';
import { Tags } from '../utils/cache-tag-generator.utils';
import { PodsInfoModel } from '@/shared/model/pods-info.model';

export type MigrationJobStatus = 'active' | 'succeeded' | 'failed' | 'not-found';

export interface MigrationStatusResult {
    status: MigrationJobStatus;
    jobName: string;
    namespace: string;
}

class PvcMigrationService {

    async migrateStorageClass(volumeId: string, targetStorageClassName: string) {
        const volume = await dataAccess.client.appVolume.findFirstOrThrow({
            where: { id: volumeId },
            include: { app: true }
        });

        if (volume.sharedVolumeId) {
            throw new ServiceException('Shared volumes cannot be migrated. Migrate the base volume instead.');
        }
        if (volume.shareWithOtherApps) {
            throw new ServiceException('Volumes that are shared with other apps cannot be migrated directly. Remove all shared attachments first.');
        }
        if (volume.storageClassName === targetStorageClassName) {
            throw new ServiceException(`Volume is already using storage class "${targetStorageClassName}".`);
        }

        const { app } = volume;
        const projectId = app.projectId;
        const appId = app.id;
        const originalReplicas = app.replicas;
        const originalMountPath = volume.containerMountPath;
        const jobName = KubeObjectNameUtils.toMigrationJobName(volumeId);

        // Check that no migration job already exists
        const existingStatus = await this.getMigrationJobStatus(volumeId, projectId);
        if (existingStatus.status !== 'not-found') {
            throw new ServiceException(`A migration job for this volume already exists (status: ${existingStatus.status}). Wait for it to finish or delete it first.`);
        }

        // Scale down the app
        await deploymentService.setReplicasToZeroAndWaitForShutdown(projectId, appId);

        let newVolumeId: string | undefined;

        try {
            // Create new AppVolume record with a temp mount path to avoid duplicate-path constraint
            const tempMountPath = `${originalMountPath}__migrating`;
            const newVolumeRecord = await dataAccess.client.appVolume.create({
                data: {
                    containerMountPath: tempMountPath,
                    size: volume.size,
                    accessMode: volume.accessMode,
                    storageClassName: targetStorageClassName,
                    shareWithOtherApps: false,
                    sharedVolumeId: null,
                    appId: appId,
                }
            });
            newVolumeId = newVolumeRecord.id;

            // Create the target PVC
            await pvcService.createPvcForVolumeIfNotExists(projectId, newVolumeRecord);

            const oldPvcName = KubeObjectNameUtils.toPvcName(volumeId);
            const newPvcName = KubeObjectNameUtils.toPvcName(newVolumeId);

            // Create migration k8s Job
            const jobDefinition: V1Job = {
                apiVersion: 'batch/v1',
                kind: 'Job',
                metadata: {
                    name: jobName,
                    namespace: projectId,
                    annotations: {
                        [Constants.QS_ANNOTATION_APP_ID]: appId,
                        [Constants.QS_ANNOTATION_PROJECT_ID]: projectId,
                        'qs-volume-id': volumeId,
                        'qs-new-volume-id': newVolumeId,
                    },
                    labels: {
                        'qs-migration-job': 'true',
                        'qs-volume-id': volumeId,
                    }
                },
                spec: {
                    ttlSecondsAfterFinished: 86400, // 24-hour retention so logs remain visible
                    template: {
                        spec: {
                            containers: [
                                {
                                    name: jobName,
                                    image: 'alpine:latest',
                                    command: ['sh', '-c'],
                                    args: [
                                        'apk add --no-cache rsync && ' +
                                        'echo "Starting rsync migration..." && ' +
                                        `rsync -av --delete /source/ /target/ && ` +
                                        'echo "Migration completed successfully."'
                                    ],
                                    volumeMounts: [
                                        { name: 'source-pvc', mountPath: '/source' },
                                        { name: 'target-pvc', mountPath: '/target' },
                                    ],
                                },
                            ],
                            volumes: [
                                { name: 'source-pvc', persistentVolumeClaim: { claimName: oldPvcName } },
                                { name: 'target-pvc', persistentVolumeClaim: { claimName: newPvcName } },
                            ],
                            restartPolicy: 'Never',
                        },
                    },
                    backoffLimit: 0,
                },
            };

            await k3s.batch.createNamespacedJob(projectId, jobDefinition);

            // Wait for job completion (up to 30 minutes)
            await this.waitForMigrationJobCompletion(jobName, projectId);

            // Success: update DB — rename old mount path, activate new volume with original path
            await dataAccess.client.$transaction(async (tx) => {
                await tx.appVolume.update({
                    where: { id: volumeId },
                    data: { containerMountPath: `${originalMountPath}_old` },
                });
                await tx.appVolume.update({
                    where: { id: newVolumeId },
                    data: { containerMountPath: originalMountPath },
                });
            });

            // Invalidate caches
            revalidateTag(Tags.app(appId));
            revalidateTag(Tags.apps(projectId));

        } catch (err) {
            // On failure: clean up the new volume record and its PVC
            if (newVolumeId) {
                try {
                    const newPvcName = KubeObjectNameUtils.toPvcName(newVolumeId);
                    await k3s.core.deleteNamespacedPersistentVolumeClaim(newPvcName, projectId)
                } catch { /* ignore */ }
                try {
                    await dataAccess.client.appVolume.delete({ where: { id: newVolumeId } })
                } catch { /* ignore */ }
                revalidateTag(Tags.app(appId));
                revalidateTag(Tags.apps(projectId));
            }
            throw err;
        }
    }

    async getMigrationJobStatus(volumeId: string, projectId: string): Promise<MigrationStatusResult> {
        const jobName = KubeObjectNameUtils.toMigrationJobName(volumeId);
        try {
            const response = await k3s.batch.readNamespacedJobStatus(jobName, projectId);
            const s = response.body.status;
            let status: MigrationJobStatus = 'active';
            if ((s?.succeeded ?? 0) > 0 || !!s?.completionTime) {
                status = 'succeeded';
            } else if ((s?.failed ?? 0) > 0) {
                status = 'failed';
            }
            return { status, jobName, namespace: projectId };
        } catch (err: any) {
            if (err?.response?.statusCode === 404 || err?.statusCode === 404) {
                return { status: 'not-found', jobName, namespace: projectId };
            }
            // Any other error — treat as not found to avoid blocking the UI
            console.warn(`Could not read migration job status for volume ${volumeId}:`, err?.message);
            return { status: 'not-found', jobName, namespace: projectId };
        }
    }

    async getPodForMigrationJob(projectId: string, jobName: string): Promise<PodsInfoModel> {
        const res = await k3s.core.listNamespacedPod(projectId, undefined, undefined, undefined, undefined, `job-name=${jobName}`);
        const pods = res.body.items;
        if (pods.length === 0) {
            throw new ServiceException(`No pod found for migration job ${jobName}`);
        }
        const pod = pods[0];
        return {
            podName: pod.metadata?.name!,
            containerName: pod.spec?.containers?.[0].name!,
        };
    }

    private async waitForMigrationJobCompletion(jobName: string, projectId: string): Promise<void> {
        const POLL_INTERVAL = 10_000; // 10s
        const MAX_ITERATIONS = 180;   // 30 minutes

        return new Promise<void>((resolve, reject) => {
            let iterations = 0;
            const intervalId = setInterval(async () => {
                try {
                    iterations++;
                    let status: MigrationJobStatus = 'active';
                    try {
                        const response = await k3s.batch.readNamespacedJobStatus(jobName, projectId);
                        const s = response.body.status;
                        if ((s?.succeeded ?? 0) > 0 || !!s?.completionTime) {
                            status = 'succeeded';
                        } else if ((s?.failed ?? 0) > 0) {
                            status = 'failed';
                        }
                    } catch (err: any) {
                        if (err?.response?.statusCode === 404 || err?.statusCode === 404) {
                            clearInterval(intervalId);
                            reject(new ServiceException(`Migration job ${jobName} disappeared unexpectedly.`));
                            return;
                        }
                        throw err;
                    }

                    if (status === 'succeeded') {
                        clearInterval(intervalId);
                        resolve();
                    } else if (status === 'failed') {
                        clearInterval(intervalId);
                        reject(new ServiceException(`Migration job ${jobName} failed. Check the migration logs for details.`));
                    } else if (iterations >= MAX_ITERATIONS) {
                        clearInterval(intervalId);
                        reject(new ServiceException(`Migration job ${jobName} timed out after 30 minutes.`));
                    } else {
                        console.log(`Migration job ${jobName} is still running (iteration ${iterations})...`);
                    }
                } catch (err) {
                    clearInterval(intervalId);
                    reject(err);
                }
            }, POLL_INTERVAL);
        });
    }
}

const pvcMigrationService = new PvcMigrationService();
export default pvcMigrationService;
