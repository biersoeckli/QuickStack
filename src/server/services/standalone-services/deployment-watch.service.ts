import * as k8s from '@kubernetes/client-node';
import { V1Deployment } from '@kubernetes/client-node';
import k3s from '../../adapter/kubernetes-api.adapter';

export type DeploymentWatchListener = (type: string, deployment: V1Deployment) => void | Promise<void>;

declare global {
    var deploymentWatchServiceInstance: DeploymentWatchService | undefined;
}

class DeploymentWatchService {
    private isWatchRunning = false;
    private watchRequest: { abort: () => void } | null = null;
    private restartTimeout: NodeJS.Timeout | null = null;
    private watchGeneration = 0;
    private subscribers = new Set<DeploymentWatchListener>();

    /**
     * Registers a subscriber and makes sure exactly one shared deployments watch is running.
     * Returns an unsubscribe function; the watch is aborted once the last subscriber detaches.
     */
    subscribe(listener: DeploymentWatchListener): () => void {
        this.subscribers.add(listener);
        void this.startWatch();

        let isSubscribed = true;
        return () => {
            if (!isSubscribed) {
                return;
            }
            isSubscribed = false;
            this.subscribers.delete(listener);
            if (this.subscribers.size === 0) {
                this.stopWatch();
            }
        };
    }

    private async startWatch() {
        if (this.isWatchRunning || this.subscribers.size === 0) {
            return;
        }
        this.isWatchRunning = true;
        const generation = ++this.watchGeneration;
        console.log('[DeploymentWatch] Starting deployments watch...');

        try {
            const watch = new k8s.Watch(k3s.getKubeConfig());
            const watchRequest = await watch.watch(
                '/apis/apps/v1/deployments',
                {},
                (type: string, apiObj: unknown) => {
                    if (generation !== this.watchGeneration) {
                        return;
                    }
                    this.notify(type, apiObj as V1Deployment);
                },
                (err: unknown) => {
                    if (generation !== this.watchGeneration) {
                        return;
                    }
                    if (err) {
                        console.error('[DeploymentWatch] Watch error:', err);
                    }
                    console.log('[DeploymentWatch] Watch ended, restarting in 5s...');
                    this.isWatchRunning = false;
                    this.watchRequest = null;
                    this.scheduleRestart();
                },
            );

            if (generation !== this.watchGeneration) {
                watchRequest?.abort?.();
                return;
            }
            this.watchRequest = watchRequest;
        } catch (error) {
            if (generation !== this.watchGeneration) {
                return;
            }
            console.error('[DeploymentWatch] Failed to start watch:', error);
            this.isWatchRunning = false;
            this.watchRequest = null;
            this.scheduleRestart();
        }
    }

    private scheduleRestart() {
        if (this.subscribers.size === 0 || this.restartTimeout) {
            return;
        }
        this.restartTimeout = setTimeout(() => {
            this.restartTimeout = null;
            void this.startWatch();
        }, 5000);
    }

    private stopWatch() {
        this.watchGeneration++;
        this.isWatchRunning = false;
        if (this.restartTimeout) {
            clearTimeout(this.restartTimeout);
            this.restartTimeout = null;
        }
        if (this.watchRequest && typeof this.watchRequest.abort === 'function') {
            this.watchRequest.abort();
        }
        this.watchRequest = null;
        console.log('[DeploymentWatch] Stopped deployments watch, no subscribers left.');
    }

    private notify(type: string, deployment: V1Deployment) {
        for (const subscriber of this.subscribers) {
            try {
                const result = subscriber(type, deployment);
                if (result && typeof result.then === 'function') {
                    result.catch((error) => console.error('[DeploymentWatch] Subscriber error:', error));
                }
            } catch (error) {
                console.error('[DeploymentWatch] Subscriber error:', error);
            }
        }
    }
}

const deploymentWatchService = globalThis.deploymentWatchServiceInstance ?? new DeploymentWatchService();
globalThis.deploymentWatchServiceInstance = deploymentWatchService;
export default deploymentWatchService;
