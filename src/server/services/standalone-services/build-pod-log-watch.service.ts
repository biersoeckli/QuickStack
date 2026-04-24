import * as k8s from '@kubernetes/client-node';
import { V1ContainerStatus, V1Pod } from '@kubernetes/client-node';
import { Constants } from '@/shared/utils/constants';
import k3s from '../../adapter/kubernetes-api.adapter';
import { dlog } from '../deployment-logs.service';
import { BUILD_NAMESPACE } from '../registry.service';
import stream from 'stream';

declare global {
    var buildPodLogWatchServiceInstance: BuildPodLogWatchService | undefined;
}

class BuildPodLogWatchService {
    private isWatchRunning = false;
    private processedContainerKeys = new Set<string>();
    private activeContainerKeys = new Set<string>();

    async startWatch() {
        if (this.isWatchRunning) {
            console.log('[BuildPodLogWatch] Watch already running, skipping start.');
            return;
        }

        this.isWatchRunning = true;
        console.log('[BuildPodLogWatch] Starting build pod log watch...');
        //  await this.captureLogsForExistingPods();

        const watch = new k8s.Watch(k3s.getKubeConfig());
        await watch.watch(
            `/api/v1/namespaces/${BUILD_NAMESPACE}/pods`,
            {},
            async (type: string, apiObj: unknown) => {
                try {
                    await this.handlePodEvent(type, apiObj as V1Pod);
                } catch (error) {
                    console.error('[BuildPodLogWatch] Error handling pod event:', error);
                }
            },
            (err: unknown) => {
                if (err) {
                    console.error('[BuildPodLogWatch] Watch error:', err);
                }
                console.log('[BuildPodLogWatch] Watch ended, restarting in 5s...');
                this.isWatchRunning = false;
                setTimeout(() => {
                    this.startWatch().catch((error) => {
                        console.error('[BuildPodLogWatch] Failed to restart watch:', error);
                    });
                }, 5000);
            },
        );
    }

    private async handlePodEvent(type: string, pod: V1Pod) {
        if (type === 'DELETED') {
            return;
        }
        await this.captureLogsForPod(pod);
    }

    private async captureLogsForPod(pod: V1Pod) {
        const deploymentId = pod.metadata?.annotations?.[Constants.QS_ANNOTATION_DEPLOYMENT_ID];
        if (!deploymentId) {
            return;
        }

        const podName = pod.metadata?.name;
        if (!podName) {
            return;
        }

        const containersOfThisPod = this.getReadableContainersInOrder(pod);
        for (const container of containersOfThisPod) {
            const containerKey = this.createContainerKey(pod, container.name);
            if (this.processedContainerKeys.has(containerKey) || this.activeContainerKeys.has(containerKey)) {
                continue;
            }

            void this.streamContainerLogs(deploymentId, podName, container.name, containerKey, !!container.status?.state?.running);
        }
    }

    private getReadableContainersInOrder(pod: V1Pod): Array<{ name: string; status?: V1ContainerStatus }> {
        const initStatuses = pod.status?.initContainerStatuses ?? [];
        const containerStatuses = pod.status?.containerStatuses ?? [];

        return [
            ...(pod.spec?.initContainers ?? []).filter((container) => {
                // th elogs of the container wich waits for the build to start does not contain useful information, so we skip it.
                return !container.name.toLowerCase().includes(Constants.QS_BUILD_INIT_CONTAINER_NAME.toLowerCase());
            }).map((container) => ({
                name: container.name!,
                status: initStatuses.find((status) => status.name === container.name),
            })),
            ...(pod.spec?.containers ?? []).map((container) => ({
                name: container.name!,
                status: containerStatuses.find((status) => status.name === container.name),
            })),
        ].filter((container) => !!container.status?.state?.running || !!container.status?.state?.terminated);
    }

    private createContainerKey(pod: V1Pod, containerName: string) {
        return `${pod.metadata?.uid ?? pod.metadata?.name}:${containerName}`;
    }

    private async streamContainerLogs(
        deploymentId: string,
        podName: string,
        containerName: string,
        containerKey: string,
        follow: boolean,
    ) {
        this.activeContainerKeys.add(containerKey);
        await dlog(deploymentId, `[INFO] Streaming logs from pod "${podName}" container "${containerName}"`);

        const logStream = new stream.PassThrough();
        let logRequest: { abort?: () => void } | undefined;
        try {
            logRequest = await k3s.log.log(BUILD_NAMESPACE, podName, containerName, logStream, {
                follow,
                tailLines: undefined,
                timestamps: true,
                pretty: false,
                previous: false,
            });
        } catch (error) {
            this.activeContainerKeys.delete(containerKey);
            await dlog(deploymentId, `[ERROR] Failed to start log stream for pod "${podName}" container "${containerName}".`);
            console.error(`[BuildPodLogWatch] Failed to start log stream for ${podName}/${containerName}:`, error);
            return;
        }

        let settled = false;
        const finalize = async (error?: unknown) => {
            if (settled) {
                return;
            }
            settled = true;
            this.activeContainerKeys.delete(containerKey);
            this.processedContainerKeys.add(containerKey);
            logRequest?.abort?.();

            if (error) {
                console.error(`[BuildPodLogWatch] Error while streaming ${podName}/${containerName}:`, error);
                await dlog(deploymentId, `[ERROR] An unexpected error occurred while streaming logs from pod "${podName}" container "${containerName}".`);
            }
        };

        logStream.on('data', (chunk) => {
            void dlog(deploymentId, chunk.toString(), false, false);
        });
        logStream.on('error', (error) => {
            void finalize(error);
        });
        logStream.on('end', () => {
            void finalize();
        });
    }
}

const buildPodLogWatchService = globalThis.buildPodLogWatchServiceInstance ?? new BuildPodLogWatchService();
globalThis.buildPodLogWatchServiceInstance = buildPodLogWatchService;
export default buildPodLogWatchService;
