vi.mock('@/server/adapter/kubernetes-api.adapter', () => ({
    kubernetesPatchOptions: vi.fn(),
    default: {
        apps: { readNamespacedDeployment: vi.fn() },
        customObjects: {
            getNamespacedCustomObject: vi.fn(),
            createNamespacedCustomObject: vi.fn(),
            patchNamespacedCustomObject: vi.fn(),
            deleteNamespacedCustomObject: vi.fn(),
        },
    },
}));

import k3s from '@/server/adapter/kubernetes-api.adapter';
import certManagerAddonService from './cert-manager-addon.service';

const notFound = Object.assign(new Error('Not Found'), { code: 404 });

function deployment(version = 'v1.18.6', available = true) {
    return { spec: { template: { spec: { containers: [{ image: `quay.io/jetstack/cert-manager-controller:${version}` }] } } }, status: { conditions: available ? [{ type: 'Available', status: 'True' }] : [] } };
}

function ready(version = 'v1.18.6') {
    vi.mocked(k3s.apps.readNamespacedDeployment)
        .mockResolvedValueOnce(deployment(version) as any)
        .mockResolvedValueOnce(deployment(version) as any)
        .mockResolvedValueOnce(deployment(version) as any);
}

describe('CertManagerAddonService', () => {
    beforeEach(() => vi.resetAllMocks());

    it('reports notInstalled when the controller is absent', async () => {
        vi.mocked(k3s.apps.readNamespacedDeployment).mockRejectedValue(notFound);
        await expect(certManagerAddonService.getStatus()).resolves.toEqual({ status: 'notInstalled' });
    });

    it('reports ready with the controller version', async () => {
        ready();
        await expect(certManagerAddonService.getStatus()).resolves.toEqual({ status: 'ready', installedVersion: 'v1.18.6' });
    });

    it('reports installing while a controller is unavailable', async () => {
        vi.mocked(k3s.apps.readNamespacedDeployment)
            .mockResolvedValueOnce(deployment() as any)
            .mockResolvedValueOnce(deployment('v1.18.6', false) as any)
            .mockResolvedValueOnce(deployment() as any);
        await expect(certManagerAddonService.getStatus()).resolves.toMatchObject({ status: 'installing' });
    });

    it('creates the k3s HelmChart through the Kubernetes API on install', async () => {
        vi.mocked(k3s.apps.readNamespacedDeployment).mockRejectedValue(notFound);
        vi.mocked(k3s.customObjects.getNamespacedCustomObject).mockRejectedValue(notFound);
        vi.mocked(k3s.customObjects.createNamespacedCustomObject).mockResolvedValue({} as any);

        await expect(certManagerAddonService.install()).resolves.toMatchObject({ status: 'succeeded', release: { version: 'v1.20.3' }, resources: [{ kind: 'HelmChart', namespace: 'kube-system' }] });
        expect(k3s.customObjects.createNamespacedCustomObject).toHaveBeenCalledWith(expect.objectContaining({
            group: 'helm.cattle.io',
            version: 'v1',
            namespace: 'kube-system',
            plural: 'helmcharts',
            body: expect.objectContaining({
                spec: expect.objectContaining({
                    chart: 'oci://quay.io/jetstack/charts/cert-manager',
                    version: 'v1.20.3',
                    targetNamespace: 'cert-manager',
                    createNamespace: true,
                    takeOwnership: true,
                    set: { 'crds.enabled': 'true' },
                }),
            }),
        }));
    });

    it('patches the HelmChart for an update', async () => {
        ready('v1.19.6');
        vi.mocked(k3s.customObjects.getNamespacedCustomObject).mockResolvedValue({} as any);
        vi.mocked(k3s.customObjects.patchNamespacedCustomObject).mockResolvedValue({} as any);

        await expect(certManagerAddonService.update()).resolves.toMatchObject({ status: 'succeeded', release: { version: 'v1.20.3' } });
        expect(k3s.customObjects.patchNamespacedCustomObject).toHaveBeenCalledWith(expect.objectContaining({ body: expect.objectContaining({ spec: expect.objectContaining({ version: 'v1.20.3' }) }) }), undefined);
    });

    it('does not offer an update when CertManager already runs the newest managed release', async () => {
        ready('v1.20.3');
        vi.mocked(k3s.customObjects.getNamespacedCustomObject).mockResolvedValue({
            spec: { repo: 'oci://quay.io/jetstack/charts', chart: 'oci://quay.io/jetstack/charts/cert-manager', version: 'v1.20.3' },
        } as any);

        await expect(certManagerAddonService.getAvailableUpdate()).resolves.toBeUndefined();
    });

    it('rejects an update for an unmanaged version', async () => {
        ready('v1.17.0');
        await expect(certManagerAddonService.update()).rejects.toThrow('Installed CertManager version v1.17.0 is not managed by QuickStack.');
    });

    it('deletes the HelmChart through the Kubernetes API on uninstall', async () => {
        ready();
        vi.mocked(k3s.customObjects.deleteNamespacedCustomObject).mockResolvedValue({} as any);

        await expect(certManagerAddonService.uninstall()).resolves.toMatchObject({ status: 'succeeded' });
        expect(k3s.customObjects.deleteNamespacedCustomObject).toHaveBeenCalledWith({ group: 'helm.cattle.io', version: 'v1', namespace: 'kube-system', plural: 'helmcharts', name: 'cert-manager' });
    });

    it('returns HelmChart API failures as failed operations', async () => {
        vi.mocked(k3s.apps.readNamespacedDeployment).mockRejectedValue(notFound);
        vi.mocked(k3s.customObjects.getNamespacedCustomObject).mockRejectedValue(notFound);
        vi.mocked(k3s.customObjects.createNamespacedCustomObject).mockRejectedValue(new Error('forbidden'));

        await expect(certManagerAddonService.install()).resolves.toMatchObject({ status: 'failed', error: '1 Kubernetes resource(s) failed.', resources: [{ kind: 'HelmChart', status: 'failed', error: 'forbidden' }] });
    });
});
