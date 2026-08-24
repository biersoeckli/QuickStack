vi.mock('@/server/adapter/kubernetes-api.adapter', () => ({
    K3sApiAdapter: {
        isNotFoundError: (error: any) => error?.code === 404,
    },
    default: {
        apps: {
            readNamespacedDeployment: vi.fn(),
        },
        customObjects: {
            listCustomObjectForAllNamespaces: vi.fn(),
        },
        applyResource: vi.fn(),
        deleteResource: vi.fn(),
    },
}));

vi.mock('@/server/adapter/agent-sandbox-manifest.adapter', () => ({
    default: {
        getResources: vi.fn(),
    },
}));

import k3s from '@/server/adapter/kubernetes-api.adapter';
import agentSandboxManifestAdapter from '@/server/adapter/agent-sandbox-manifest.adapter';
import agentSandboxAddonService from './agent-sandbox-addon.service';

const notFound = Object.assign(new Error('Not Found'), { code: 404 });

describe('AgentSandboxAddonService', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('reports notInstalled when the extension CRDs are absent', async () => {
        vi.mocked(k3s.customObjects.listCustomObjectForAllNamespaces).mockRejectedValue(notFound);

        await expect(agentSandboxAddonService.getStatus()).resolves.toEqual({ status: 'notInstalled' });
    });

    it('reports ready when the extension CRD and controller deployment are available', async () => {
        vi.mocked(k3s.customObjects.listCustomObjectForAllNamespaces).mockResolvedValue({ items: [] } as any);
        vi.mocked(k3s.apps.readNamespacedDeployment).mockResolvedValue({
            spec: { template: { spec: { containers: [{ image: 'registry/controller:v0.5.6' }] } } },
            status: { conditions: [{ type: 'Available', status: 'True' }] },
        } as any);

        await expect(agentSandboxAddonService.getStatus()).resolves.toEqual({
            status: 'ready',
            installedVersion: 'v0.5.6',
        });
    });

    it('installs namespaced and cluster-scoped manifest resources', async () => {
        vi.mocked(k3s.customObjects.listCustomObjectForAllNamespaces).mockRejectedValue(notFound);
        vi.mocked(agentSandboxManifestAdapter.getResources).mockResolvedValue([
            { apiVersion: 'v1', kind: 'Namespace', metadata: { name: 'agent-sandbox-system' } },
            { apiVersion: 'apps/v1', kind: 'Deployment', metadata: { name: 'agent-sandbox-controller', namespace: 'agent-sandbox-system' } },
        ]);
        vi.mocked(k3s.applyResource).mockResolvedValue(undefined);

        await expect(agentSandboxAddonService.install()).resolves.toMatchObject({
            status: 'succeeded',
            resources: [{ kind: 'Namespace', status: 'succeeded' }, { kind: 'Deployment', status: 'succeeded' }],
        });
        expect(k3s.applyResource).toHaveBeenNthCalledWith(1, expect.anything(), undefined);
        expect(k3s.applyResource).toHaveBeenNthCalledWith(2, expect.anything(), 'agent-sandbox-system');
    });

    it('returns each failed apply instead of hiding a partial installation', async () => {
        vi.mocked(k3s.customObjects.listCustomObjectForAllNamespaces).mockRejectedValue(notFound);
        vi.mocked(agentSandboxManifestAdapter.getResources).mockResolvedValue([
            { apiVersion: 'apiextensions.k8s.io/v1', kind: 'CustomResourceDefinition', metadata: { name: 'sandboxes.agents.x-k8s.io' } },
        ]);
        vi.mocked(k3s.applyResource).mockRejectedValue(new Error('forbidden'));

        await expect(agentSandboxAddonService.install()).resolves.toMatchObject({
            status: 'failed',
            error: '1 Kubernetes resource(s) failed.',
            resources: [{ status: 'failed', error: 'forbidden' }],
        });
    });

    it('offers only the next newer release and applies that release on update', async () => {
        vi.mocked(k3s.customObjects.listCustomObjectForAllNamespaces).mockResolvedValue({ items: [] } as any);
        vi.mocked(k3s.apps.readNamespacedDeployment).mockResolvedValue({
            spec: { template: { spec: { containers: [{ image: 'registry/controller:v0.5.5' }] } } },
            status: { conditions: [{ type: 'Available', status: 'True' }] },
        } as any);
        vi.mocked(agentSandboxManifestAdapter.getResources).mockResolvedValue([
            { apiVersion: 'v1', kind: 'Namespace', metadata: { name: 'agent-sandbox-system' } },
        ]);
        vi.mocked(k3s.applyResource).mockResolvedValue(undefined);

        await expect(agentSandboxAddonService.getAvailableUpdate()).resolves.toMatchObject({ version: 'v0.5.6' });
        await expect(agentSandboxAddonService.update()).resolves.toMatchObject({
            status: 'succeeded',
            release: { version: 'v0.5.6' },
        });
        expect(agentSandboxManifestAdapter.getResources).toHaveBeenCalledWith(
            expect.objectContaining({ version: 'v0.5.6' }),
        );
    });

    it('refuses uninstall while Sandbox resources still exist', async () => {
        vi.mocked(k3s.customObjects.listCustomObjectForAllNamespaces)
            .mockResolvedValueOnce({ items: [] } as any)
            .mockResolvedValueOnce({ items: [] } as any)
            .mockResolvedValueOnce({ items: [{ metadata: { name: 'sandbox-1' } }] } as any);
        vi.mocked(k3s.customObjects.listCustomObjectForAllNamespaces).mockResolvedValue({ items: [] } as any);
        vi.mocked(k3s.apps.readNamespacedDeployment).mockResolvedValue({
            spec: { template: { spec: { containers: [{ image: 'registry/controller:v0.5.5' }] } } },
            status: { conditions: [{ type: 'Available', status: 'True' }] },
        } as any);

        await expect(agentSandboxAddonService.uninstall()).rejects.toThrow(
            'Cannot uninstall Kubernetes Agent Sandbox while 1 Sandbox resource(s) still exist.',
        );
    });
});
