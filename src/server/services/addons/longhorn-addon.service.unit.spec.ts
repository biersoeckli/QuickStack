vi.mock('@/server/adapter/kubernetes-api.adapter', () => ({
    default: {
        apps: { readNamespacedDaemonSet: vi.fn() },
        core: { listNamespacedPod: vi.fn() },
        applyResource: vi.fn(),
    },
}));

vi.mock('@/server/adapter/longhorn-manifest.adapter', () => ({
    default: { getResources: vi.fn() },
}));

vi.mock('@/server/adapter/qs-versioninfo.adapter', () => ({
    qsVersionInfoAdapter: { getLonghornReleaseCatalog: vi.fn() },
}));

vi.mock('../param.service', () => ({
    ParamService: { USE_CANARY_CHANNEL: 'USE_CANARY_CHANNEL' },
    default: { getBoolean: vi.fn() },
}));

import k3s from '@/server/adapter/kubernetes-api.adapter';
import longhornManifestAdapter from '@/server/adapter/longhorn-manifest.adapter';
import { qsVersionInfoAdapter } from '@/server/adapter/qs-versioninfo.adapter';
import paramService from '../param.service';
import longhornAddonService from './longhorn-addon.service';

const notFound = Object.assign(new Error('Not Found'), { code: 404 });
const release172 = { version: 'v1.7.2', yamlUrl: 'https://example.test/v1.7.2.yaml' };
const release182 = { version: 'v1.8.2', yamlUrl: 'https://example.test/v1.8.2.yaml' };

function ready(version = 'v1.7.2') {
    vi.mocked(k3s.apps.readNamespacedDaemonSet).mockResolvedValue({
        spec: { template: { spec: { containers: [{ image: `longhornio/longhorn-manager:${version}` }] } } },
    } as any);
    vi.mocked(k3s.core.listNamespacedPod).mockResolvedValue({ items: [{ status: { phase: 'Running' } }] } as any);
}

describe('LonghornAddonService', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.mocked(paramService.getBoolean).mockResolvedValue(false);
        vi.mocked(qsVersionInfoAdapter.getLonghornReleaseCatalog).mockResolvedValue({
            installRelease: release172,
            releases: [release172, release182],
        });
    });

    it('reports notInstalled when the Longhorn manager DaemonSet is absent', async () => {
        vi.mocked(k3s.apps.readNamespacedDaemonSet).mockRejectedValue(notFound);
        await expect(longhornAddonService.getStatus()).resolves.toEqual({ status: 'notInstalled' });
    });

    it('reports ready with the manager image version when all Longhorn pods are ready', async () => {
        ready('v1.7.2');
        await expect(longhornAddonService.getStatus()).resolves.toEqual({ status: 'ready', installedVersion: 'v1.7.2' });
    });

    it('reports updating while a Longhorn pod is not ready', async () => {
        ready();
        vi.mocked(k3s.core.listNamespacedPod).mockResolvedValue({
            items: [{ metadata: { name: 'longhorn-manager-1' }, status: { phase: 'Pending' } }],
        } as any);
        await expect(longhornAddonService.getStatus()).resolves.toMatchObject({
            status: 'updating',
            message: 'Waiting for Longhorn pod longhorn-manager-1 to become ready.',
        });
    });

    it('installs the selected channel install release', async () => {
        vi.mocked(k3s.apps.readNamespacedDaemonSet).mockRejectedValue(notFound);
        vi.mocked(longhornManifestAdapter.getResources).mockResolvedValue([
            { apiVersion: 'v1', kind: 'Namespace', metadata: { name: 'longhorn-system' } },
        ]);
        vi.mocked(k3s.applyResource).mockResolvedValue(undefined);

        await expect(longhornAddonService.install()).resolves.toMatchObject({
            status: 'succeeded', release: { version: 'v1.7.2' },
        });
        expect(qsVersionInfoAdapter.getLonghornReleaseCatalog).toHaveBeenCalledWith(false);
        expect(longhornManifestAdapter.getResources).toHaveBeenCalledWith(expect.objectContaining({ manifestUrl: release172.yamlUrl }));
    });

    it('updates to exactly the next managed release', async () => {
        ready('v1.7.2');
        vi.mocked(longhornManifestAdapter.getResources).mockResolvedValue([]);

        await expect(longhornAddonService.update()).resolves.toMatchObject({
            status: 'succeeded', release: { version: 'v1.8.2' },
        });
    });

    it('uses the newest channel release when the installed version is unknown', async () => {
        ready('v1.6.0');
        await expect(longhornAddonService.getAvailableUpdate()).resolves.toMatchObject({ version: 'v1.8.2' });
    });

    it('refuses an update while Longhorn pods are still reconciling', async () => {
        ready();
        vi.mocked(k3s.core.listNamespacedPod).mockResolvedValue({ items: [{ status: { phase: 'Pending' } }] } as any);
        await expect(longhornAddonService.update()).rejects.toThrow('A Longhorn upgrade is already in progress. Please wait for it to complete.');
    });

    it('returns every manifest apply failure', async () => {
        vi.mocked(k3s.apps.readNamespacedDaemonSet).mockRejectedValue(notFound);
        vi.mocked(longhornManifestAdapter.getResources).mockResolvedValue([
            { apiVersion: 'apps/v1', kind: 'DaemonSet', metadata: { name: 'longhorn-manager', namespace: 'longhorn-system' } },
        ]);
        vi.mocked(k3s.applyResource).mockRejectedValue(new Error('forbidden'));

        await expect(longhornAddonService.install()).resolves.toMatchObject({
            status: 'failed', error: '1 Kubernetes resource(s) failed.',
            resources: [{ status: 'failed', error: 'forbidden' }],
        });
    });
});
