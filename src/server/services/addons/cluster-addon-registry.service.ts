import { ClusterAddon } from './cluster-addon.interface';
import agentSandboxAddonService from './agent-sandbox-addon.service';
import certManagerAddonService from './cert-manager-addon.service';
import longhornAddonService from './longhorn-addon.service';

class ClusterAddonRegistryService {
    private readonly addons: readonly ClusterAddon[] = [
        longhornAddonService,
        agentSandboxAddonService,
        certManagerAddonService
    ];

    getAll(): readonly ClusterAddon[] {
        return this.addons;
    }

    getById(id: string): ClusterAddon | undefined {
        return this.addons.find((addon) => addon.metadata.id === id);
    }
}

const clusterAddonRegistryService = new ClusterAddonRegistryService();
export default clusterAddonRegistryService;
