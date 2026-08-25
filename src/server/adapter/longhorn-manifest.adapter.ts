import { AddonRelease } from '@/shared/model/cluster-addon.model';
import { AddonKubernetesUtils } from '@/server/utils/addon-kubernetes.utils';

class LonghornManifestAdapter {
    async getResources(release: AddonRelease): Promise<any[]> {
        return AddonKubernetesUtils.fetchManifestYaml(release.manifestUrl, 'Longhorn');
    }
}

const longhornManifestAdapter = new LonghornManifestAdapter();
export default longhornManifestAdapter;
