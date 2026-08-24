import { ClusterAddon } from './cluster-addon.interface';
import agentSandboxAddonService from './agent-sandbox-addon.service';

class ClusterAddonRegistryService {
    private readonly addons: readonly ClusterAddon[] = [agentSandboxAddonService];

    getAll(): readonly ClusterAddon[] {
        return this.addons;
    }

    getById(id: string): ClusterAddon | undefined {
        return this.addons.find((addon) => addon.metadata.id === id);
    }
}

const clusterAddonRegistryService = new ClusterAddonRegistryService();
export default clusterAddonRegistryService;
