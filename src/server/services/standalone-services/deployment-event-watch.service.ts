import * as k8s from '@kubernetes/client-node';
import { CoreV1Event } from '@kubernetes/client-node';
import { Constants } from '../../../shared/utils/constants';
import k3s from '../../adapter/kubernetes-api.adapter';
import { dlog } from '../deployment-logs.service';

declare global {
    var deploymentEventWatchServiceInstance: DeploymentEventWatchService | undefined;
}

class DeploymentEventWatchService {
    private isWatchRunning = false;
    private processedEvents = new Set<string>();

    async startWatch() {
        if (this.isWatchRunning) {
            console.log('[DeploymentEventWatch] Watch already running, skipping start.');
            return;
        }
        this.isWatchRunning = true;
        console.log('[DeploymentEventWatch] Starting deployment event watch...');

        const kc = k3s.getKubeConfig();
        const watch = new k8s.Watch(kc);

        await watch.watch(
            `/api/v1/events`,
            {},
            async (type: string, apiObj: unknown) => {
                try {
                    const event = apiObj as CoreV1Event;
                    await this.handleEvent(type, event);
                } catch (e) {
                    console.error('[DeploymentEventWatch] Error handling event:', e);
                }
            },
            (err: unknown) => {
                if (err) console.error('[DeploymentEventWatch] Watch error:', err);
                console.log('[DeploymentEventWatch] Watch ended, restarting in 5s...');
                this.isWatchRunning = false;
                setTimeout(() => this.startWatch(), 5000);
            }
        );
    }

    private async handleEvent(type: string, event: CoreV1Event) {
        if (type !== 'ADDED') return;
        if (event.involvedObject?.kind !== 'Pod') return;

        const eventUid = event.metadata?.uid;
        if (!eventUid) return;
        if (this.processedEvents.has(eventUid)) return;
        this.processedEvents.add(eventUid);

        const podName = event.involvedObject.name;
        const namespace = event.involvedObject.namespace;
        if (!podName || !namespace) return;

        const irrelevantNamespaces = ['kube-system', 'kube-public', 'longhorn-system', 'kube-node-lease', 'cert-manager', 'quickstack'];
        if (irrelevantNamespaces.includes(namespace)) return;

        try {
            const podResponse = await k3s.core.readNamespacedPod(podName, namespace);
            const pod = podResponse.body;
            const deploymentId = pod.metadata?.annotations?.[Constants.QS_ANNOTATION_DEPLOYMENT_ID];
            if (!deploymentId) return;

            const eventType = event.type ?? 'Unknown';
            const reason = event.reason ?? 'Unknown';
            const message = event.message ?? '';

            await dlog(deploymentId, `[event] ${eventType}/${reason}: ${message}`);
        } catch {
            // Pod may already be gone — silently skip
        }
    }
}

const deploymentEventWatchService = globalThis.deploymentEventWatchServiceInstance ?? new DeploymentEventWatchService();
globalThis.deploymentEventWatchServiceInstance = deploymentEventWatchService;
export default deploymentEventWatchService;
