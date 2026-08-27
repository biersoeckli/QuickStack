import { AddonRelease } from '@/shared/model/cluster-addon.model';
import { AddonKubernetesUtils } from '@/server/utils/addon-kubernetes.utils';

class AgentSandboxManifestAdapter {
    async getResources(release: AddonRelease): Promise<any[]> {
        return AddonKubernetesUtils.fetchManifestYaml(release.manifestUrl, 'Kubernetes Agent Sandbox');
    }
}

const agentSandboxManifestAdapter = new AgentSandboxManifestAdapter();
export default agentSandboxManifestAdapter;
