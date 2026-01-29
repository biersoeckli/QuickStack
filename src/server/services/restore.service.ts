import dataAccess from "../adapter/db.client";
import { PathUtils } from "../utils/path.utils";
import fs from 'fs/promises';
import podService from "./pod.service";
import standalonePodService from "./standalone-services/standalone-pod.service";
import { FsUtils } from "../utils/fs.utils";
import deploymentService from "./deployment.service";
import k3s from "../adapter/kubernetes-api.adapter";
import { KubeObjectNameUtils } from "../utils/kube-object-name.utils";

class RestoreService {

    async restore(file: File, volumeId: string) {

        const volume = await dataAccess.client.appVolume.findFirstOrThrow({
            where: {
                id: volumeId
            },
            include: {
                app: true
            }
        });

        const restoreTempFolder = PathUtils.tempBackupResotreFolder;
        const tempBackupRestoreArchivePath = PathUtils.backupRestoreFolder(volumeId);

        try {
            await FsUtils.createDirIfNotExistsAsync(restoreTempFolder, true);
            const buffer = await file.arrayBuffer();
            await fs.writeFile(tempBackupRestoreArchivePath, Buffer.from(buffer));

            console.log(`Shutting down applicaton...`);
            await deploymentService.setReplicasForDeployment(volume.app.projectId, volume.app.id, 0);
            const podNames = await podService.getPodsForApp(volume.app.projectId, volume.app.id);
            for (const pod of podNames) {
                await podService.waitUntilPodIsTerminated(volume.app.projectId, pod.podName);
            }

            console.log(`Starting temporary restore pod...`);
            await this.startAplineImageInNamespace(volume.app.projectId, volumeId);
            await podService.waitUntilPodIsRunningFailedOrSucceded(volume.app.projectId, KubeObjectNameUtils.toRestorePodName(volumeId));
            const restorePod = await podService.getPodInfoByName(volume.app.projectId, KubeObjectNameUtils.toRestorePodName(volumeId));

            console.log(`Removing old data on volume...`);
            await standalonePodService.runCommandInPod(volume.app.projectId, restorePod.podName, restorePod.containerName, ['sh', '-c', 'rm -rf /restore/*']);

            console.log(`Extracting backup to volume...`);
            await standalonePodService.cpTarToPod(volume.app.projectId, restorePod.podName, restorePod.containerName, tempBackupRestoreArchivePath, '/restore');

            console.log('Restore completed successfully');

        } finally {
            console.log(`Cleaning up from backup restore...`);
            await podService.deleteRestorePodIfExists(volume.app.projectId, KubeObjectNameUtils.toRestorePodName(volumeId));
            await FsUtils.deleteFileIfExists(tempBackupRestoreArchivePath);
        }
    }

    async startAplineImageInNamespace(namespace: string, volumeId: string) {
        const volume = await dataAccess.client.appVolume.findFirstOrThrow({
            where: {
                id: volumeId
            },
            select: {
                sharedVolumeId: true
            }
        });
        const name = KubeObjectNameUtils.toRestorePodName(volumeId);
        const pvcName = KubeObjectNameUtils.toPvcName(volume.sharedVolumeId ?? volumeId);

        const existingPods = await k3s.core.listNamespacedPod(namespace);
        const pod = existingPods.body.items.find((item) => item.metadata?.labels?.app === name);
        if (pod) {
            return;
        }

        await k3s.core.createNamespacedPod(namespace, {
            metadata: {
                name: name,
                labels: {
                    app: name
                }
            },
            spec: {
                containers: [{
                    name: name,
                    image: 'alpine:3',
                    command: ['sleep', '3600'],
                    tty: true,
                    stdin: true,
                    volumeMounts: [{
                        name: pvcName,
                        mountPath: '/restore'
                    }]
                }],
                volumes: [{
                    name: pvcName,
                    persistentVolumeClaim: {
                        claimName: pvcName
                    }
                }]
            }
        });
    }

}

const restoreService = new RestoreService();
export default restoreService;
