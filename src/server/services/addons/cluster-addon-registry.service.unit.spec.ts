vi.mock('./agent-sandbox-addon.service', () => ({
    default: { metadata: { id: 'agent-sandbox' } },
}));

vi.mock('./longhorn-addon.service', () => ({
    default: { metadata: { id: 'longhorn' } },
}));

vi.mock('./cert-manager-addon.service', () => ({
    default: { metadata: { id: 'cert-manager' } },
}));

vi.mock('./gvisor-addon.service', () => ({
    default: { metadata: { id: 'gvisor' } },
}));

import clusterAddonRegistryService from './cluster-addon-registry.service';

describe('ClusterAddonRegistryService', () => {
    it('registers Longhorn as a trusted Cluster Add-on', () => {
        expect(clusterAddonRegistryService.getById('longhorn')).toMatchObject({ metadata: { id: 'longhorn' } });
    });

    it('registers CertManager as a trusted Cluster Add-on', () => {
        expect(clusterAddonRegistryService.getById('cert-manager')).toMatchObject({ metadata: { id: 'cert-manager' } });
    });

    it('registers gVisor as a trusted Cluster Add-on', () => {
        expect(clusterAddonRegistryService.getById('gvisor')).toMatchObject({ metadata: { id: 'gvisor' } });
    });
});
