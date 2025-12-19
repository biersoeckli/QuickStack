import { TraefikIpPropagationStatus } from "@/shared/model/traefik-ip-propagation.model";
import { ServiceException } from "@/shared/model/service.exception.model";
import k3s from "../adapter/kubernetes-api.adapter";

class TraefikService {
    private readonly TRAEFIK_NAMESPACE = 'kube-system';
    private readonly TRAEFIK_NAME = 'traefik';

    async getStatus(): Promise<TraefikIpPropagationStatus> {
        const [serviceRes, deploymentRes] = await Promise.all([
            k3s.core.readNamespacedService(this.TRAEFIK_NAME, this.TRAEFIK_NAMESPACE),
            k3s.apps.readNamespacedDeployment(this.TRAEFIK_NAME, this.TRAEFIK_NAMESPACE),
        ]);

        const deployment = deploymentRes.body;
        const restartedAt = deployment.spec?.template?.metadata?.annotations?.['kubectl.kubernetes.io/restartedAt'];

        return {
            externalTrafficPolicy: serviceRes.body.spec?.externalTrafficPolicy as TraefikIpPropagationStatus['externalTrafficPolicy'],
            readyReplicas: deployment.status?.readyReplicas ?? 0,
            replicas: deployment.status?.replicas ?? deployment.spec?.replicas ?? 0,
            restartedAt,
        };
    }

    async applyExternalTrafficPolicy(useLocal: boolean): Promise<TraefikIpPropagationStatus> {
        await this.patchServicePolicy(useLocal ? 'Local' : 'Cluster');
        await this.restartDeployment();
        await this.waitUntilDeploymentReady();
        return this.getStatus();
    }

    private async patchServicePolicy(policy: 'Local' | 'Cluster') {
        await k3s.core.patchNamespacedService(
            this.TRAEFIK_NAME,
            this.TRAEFIK_NAMESPACE,
            { spec: { externalTrafficPolicy: policy } },
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            { headers: { 'Content-Type': 'application/merge-patch+json' } },
        );
    }

    private async restartDeployment() {
        const now = new Date().toISOString();
        await k3s.apps.patchNamespacedDeployment(
            this.TRAEFIK_NAME,
            this.TRAEFIK_NAMESPACE,
            {
                spec: {
                    template: {
                        metadata: {
                            annotations: {
                                'kubectl.kubernetes.io/restartedAt': now,
                            },
                        },
                    },
                },
            },
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            { headers: { 'Content-Type': 'application/merge-patch+json' } },
        );
    }

    private async waitUntilDeploymentReady(timeoutMs = 120000) {
        const pollIntervalMs = 3000;
        const deadline = Date.now() + timeoutMs;

        while (Date.now() < deadline) {
            const deployment = await k3s.apps.readNamespacedDeployment(this.TRAEFIK_NAME, this.TRAEFIK_NAMESPACE);
            const desiredReplicas = deployment.body.status?.replicas ?? deployment.body.spec?.replicas ?? 0;
            const readyReplicas = deployment.body.status?.readyReplicas ?? 0;

            if (desiredReplicas === 0 || readyReplicas >= desiredReplicas) {
                return;
            }

            await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
        }

        throw new ServiceException('Timeout while waiting for Traefik pods to become ready after restart.');
    }
}

const traefikService = new TraefikService();
export default traefikService;
