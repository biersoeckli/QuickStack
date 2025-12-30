import { AppExtendedModel } from "@/shared/model/app-extended.model";
import k3s from "../adapter/kubernetes-api.adapter";
import { V1Deployment, V1Ingress, V1PersistentVolumeClaim } from "@kubernetes/client-node";
import buildService from "./build.service";
import { ListUtils } from "../../shared/utils/list.utils";
import { DeploymentInfoModel, DeploymentStatus } from "@/shared/model/deployment-info.model";
import { BuildJobStatus } from "@/shared/model/build-job";
import { ServiceException } from "@/shared/model/service.exception.model";
import { PodsInfoModel } from "@/shared/model/pods-info.model";
import { KubeObjectNameUtils } from "../utils/kube-object-name.utils";
import pvcService from "./pvc.service";
import ingressService from "./ingress.service";
import { Constants } from "../../shared/utils/constants";

class NamespaceService {

    async getNamespaces() {
        const k3sResponse = await k3s.core.listNamespace();
        return k3sResponse.body.items.map((item) => item.metadata?.name).filter((name) => !!name);
    }

    async createNamespaceIfNotExists(namespace: string) {
        const existingNamespaces = await this.getNamespaces();
        if (existingNamespaces.includes(namespace)) {
            return;
        }
        await k3s.core.createNamespace({
            metadata: {
                name: namespace,
                annotations: {
                    [Constants.QS_ANNOTATION_PROJECT_ID]: namespace
                }
            }
        });
    }

    async deleteNamespace(namespace: string) {
        const nameSpaces = await this.getNamespaces();
        if (nameSpaces.includes(namespace)) {
            await k3s.core.deleteNamespace(namespace);
        }
    }


}

const namespaceService = new NamespaceService();
export default namespaceService;
