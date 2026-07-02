import k3s from "../adapter/kubernetes-api.adapter";
import { Constants } from "../../shared/utils/constants";

class NamespaceService {

    async getNamespaces() {
        const k3sResponse = await k3s.core.listNamespace();
        return k3sResponse.items.map((item) => item.metadata?.name).filter((name) => !!name);
    }

    async createNamespaceIfNotExists(namespace: string) {
        const existingNamespaces = await this.getNamespaces();
        if (existingNamespaces.includes(namespace)) {
            return;
        }
        await k3s.core.createNamespace({
            body: {
                metadata: {
                    name: namespace,
                    annotations: {
                        [Constants.QS_ANNOTATION_PROJECT_ID]: namespace
                    }
                }
            }
        });
    }

    async deleteNamespace(namespace: string) {
        const nameSpaces = await this.getNamespaces();
        if (nameSpaces.includes(namespace)) {
            await k3s.core.deleteNamespace({ name: namespace });
        }
    }


}

const namespaceService = new NamespaceService();
export default namespaceService;
