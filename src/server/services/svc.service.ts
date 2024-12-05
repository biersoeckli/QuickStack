import { AppExtendedModel } from "@/shared/model/app-extended.model";
import k3s from "../adapter/kubernetes-api.adapter";
import { V1PersistentVolumeClaim } from "@kubernetes/client-node";
import { ServiceException } from "@/shared/model/service.exception.model";
import { AppVolume } from "@prisma/client";
import { KubeObjectNameUtils } from "../utils/kube-object-name.utils";
import { Constants } from "../../shared/utils/constants";
import { dlog } from "./deployment-logs.service";

class SvcService {

    async deleteService(projectId: string, appId: string) {
        const existingService = await this.getService(projectId, appId);
        if (!existingService) {
            return;
        }
        const returnVal = await k3s.core.deleteNamespacedService(KubeObjectNameUtils.toServiceName(appId), projectId);
        console.log(`Deleted Service ${KubeObjectNameUtils.toServiceName(appId)} in namespace ${projectId}`);
        return returnVal;
    }

    async getService(projectId: string, appId: string) {
        const allServices = await k3s.core.listNamespacedService(projectId);
        if (allServices.body.items.some((item) => item.metadata?.name === KubeObjectNameUtils.toServiceName(appId))) {
            const res = await k3s.core.readNamespacedService(KubeObjectNameUtils.toServiceName(appId), projectId);
            return res.body;
        }
    }

    async createOrUpdateService(deplyomentId: string, app: AppExtendedModel) {
        const existingService = await this.getService(app.projectId, app.id);
        // port configuration with removed duplicates
        const ports: {
            name: string;
            port: number;
            targetPort: number;
        }[] = [
            ...app.appDomains.map((domain) => ({
                name: `domain-port-${domain.id}`,
                port: domain.port,
                targetPort: domain.port
            })),
            ...app.appPorts.map((port) => ({
                name: `default-port-${port.id}`,
                port: port.port,
                targetPort: port.port
            })),
        ].filter((port, index, self) =>
            index === self.findIndex((t) =>
                (t.port === port.port && t.targetPort === port.targetPort)));

        if (ports.length === 0) {
            dlog(deplyomentId, `No domain or internal port settings found, service (HTTP) will not be created or updated. The application will run, but will not be accessible via the internal network or the internet.`);
            if (existingService) {
                await this.deleteService(app.projectId, app.id);
            }
            return;
        }

        const body = {
            metadata: {
                name: KubeObjectNameUtils.toServiceName(app.id)
            },
            spec: {
                selector: {
                    app: app.id
                },
                ports: ports
            }
        };

        dlog(deplyomentId, `Updating service (HTTP) with ports ${ports.map(x => x.port).join(', ')}...`);
        if (existingService) {
            await k3s.core.replaceNamespacedService(KubeObjectNameUtils.toServiceName(app.id), app.projectId, body);
        } else {
            await k3s.core.createNamespacedService(app.projectId, body);
        }

    }
}

const svcService = new SvcService();
export default svcService;
