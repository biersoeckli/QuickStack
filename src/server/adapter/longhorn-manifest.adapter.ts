import * as k8s from '@kubernetes/client-node';
import { AddonRelease } from '@/shared/model/cluster-addon.model';
import { ServiceException } from '@/shared/model/service.exception.model';

class LonghornManifestAdapter {
    async getResources(release: AddonRelease): Promise<any[]> {
        const response = await fetch(release.manifestUrl);
        if (!response.ok) {
            throw new ServiceException(`Failed to fetch Longhorn manifest: ${response.statusText}`);
        }
        return k8s.loadAllYaml(await response.text()).filter((spec): spec is any => Boolean(spec?.kind));
    }
}

const longhornManifestAdapter = new LonghornManifestAdapter();
export default longhornManifestAdapter;
