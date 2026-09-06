import { AppExtendedModel } from "@/shared/model/app-extended.model";
import k3s from "../adapter/kubernetes-api.adapter";
import { KubeObjectNameUtils } from "../utils/kube-object-name.utils";
import { dlog } from "./deployment-logs.service";

class SvcService {

    async deleteService(projectId: string, appId: string) {
        const existingService = await this.getService(projectId, appId);
        if (!existingService) {
            return;
        }
        const returnVal = await k3s.core.deleteNamespacedService({ name: KubeObjectNameUtils.toServiceName(appId), namespace: projectId });
        console.log(`Deleted Service ${KubeObjectNameUtils.toServiceName(appId)} in namespace ${projectId}`);
        return returnVal;
    }

    async getService(projectId: string, appId: string) {
        const allServices = await k3s.core.listNamespacedService({ namespace: projectId });
        if (allServices.items.some((item) => item.metadata?.name === KubeObjectNameUtils.toServiceName(appId))) {
            const res = await k3s.core.readNamespacedService({ name: KubeObjectNameUtils.toServiceName(appId), namespace: projectId });
            return res;
        }
    }

    async createOrUpdateServiceForApp(deplyomentId: string, app: AppExtendedModel) {
        const ports: {
            name: string;
            port: number;
            targetPort: number;
            nodePort?: number;
            protocol?: string;
        }[] = [
            ...app.appDomains.map((domain) => ({
                name: `domain-port-${domain.id}`,
                port: domain.port,
                targetPort: domain.port,
                protocol: 'TCP',
            })),
            ...(app.appNetworkPolicy?.rules ?? [])
                .filter((rule) => rule.type === 'INGRESS')
                .map((rule) => ({
                    name: `ingress-port-${rule.protocol || 'TCP'}-${rule.port}`,
                    port: rule.port,
                    targetPort: rule.port,
                    protocol: rule.protocol || 'TCP',
                })),
        ].filter((port, index, self) =>
            index === self.findIndex((candidate) =>
                candidate.port === port.port && (candidate.protocol || 'TCP') === (port.protocol || 'TCP')));

        for (const np of app.appNodePorts) {
            const protocol = np.protocol || 'TCP';
            const existing = ports.find((port) => port.port === np.port && (port.protocol || 'TCP') === protocol);
            if (existing) {
                existing.nodePort = np.nodePort;
            } else {
                ports.push({
                    name: `nodeport-${np.id}`,
                    port: np.port,
                    targetPort: np.port,
                    nodePort: np.nodePort,
                    protocol,
                });
            }
        }

        const serviceType = app.appNodePorts.length > 0 ? 'NodePort' : undefined;

        if (ports.length === 0) {
            dlog(deplyomentId, `No domain, ingress network policy, or NodePort settings found, service (HTTP) will not be created or updated. The application will run, but will not be accessible via the internal network or the internet.`);
        }

        await this.createOrUpdateService(app.projectId, app.id, ports, serviceType);

        dlog(deplyomentId, `Updating service (HTTP) with ports ${ports.map(x => x.port).join(', ')}...`);

    }

    async createOrUpdateService(namespace: string, kubeAppName: string, ports: {
        name: string;
        port: number;
        targetPort: number;
        nodePort?: number;
        protocol?: string;
    }[], serviceType?: string) {
        const existingService = await this.getService(namespace, kubeAppName);
        // port configuration with removed duplicates

        if (ports.length === 0) {
            if (existingService) {
                await this.deleteService(namespace, kubeAppName);
            }
            return;
        }

        const body = {
            metadata: {
                name: KubeObjectNameUtils.toServiceName(kubeAppName)
            },
            spec: {
                ...(serviceType ? { type: serviceType } : {}),
                selector: {
                    app: kubeAppName
                },
                ports: ports
            }
        };

        if (existingService) {
            await k3s.core.replaceNamespacedService({ name: KubeObjectNameUtils.toServiceName(kubeAppName), namespace: namespace, body: body });
        } else {
            await k3s.core.createNamespacedService({ namespace: namespace, body: body });
        }

    }
}

const svcService = new SvcService();
export default svcService;
