vi.mock('./agent-sandbox-addon.service', () => ({
    default: { metadata: { id: 'agent-sandbox' } },
}));

vi.mock('./longhorn-addon.service', () => ({
    default: { metadata: { id: 'longhorn' } },
}));

import clusterAddonRegistryService from './cluster-addon-registry.service';

describe('ClusterAddonRegistryService', () => {
    it('registers Longhorn as a trusted Cluster Add-on', () => {
        expect(clusterAddonRegistryService.getById('longhorn')).toMatchObject({ metadata: { id: 'longhorn' } });
    });
});
