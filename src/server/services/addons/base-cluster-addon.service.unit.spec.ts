vi.mock('@/server/adapter/kubernetes-api.adapter', () => ({
    K3sApiAdapter: {
        isNotFoundError: (error: any) => error?.code === 404,
    },
    default: {
        customObjects: {
            listCustomObjectForAllNamespaces: vi.fn(),
        },
        applyResource: vi.fn(),
        deleteResource: vi.fn(),
    },
}));

import k3s from '@/server/adapter/kubernetes-api.adapter';
import { BaseClusterAddon } from './base-cluster-addon.service';

class TestClusterAddon extends BaseClusterAddon {
    list() {
        return this.listResources('example.test', 'v1', 'examples');
    }

    apply(spec: any) {
        return this.applyResource(spec);
    }

    delete(spec: any) {
        return this.deleteResource(spec);
    }
}

describe('BaseClusterAddon', () => {
    const addon = new TestClusterAddon();

    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('lists custom resources through the Kubernetes adapter', async () => {
        vi.mocked(k3s.customObjects.listCustomObjectForAllNamespaces).mockResolvedValue({ items: [{ metadata: { name: 'one' } }] } as any);

        await expect(addon.list()).resolves.toEqual([{ metadata: { name: 'one' } }]);
    });

    it('returns a failed resource operation when apply fails', async () => {
        vi.mocked(k3s.applyResource).mockRejectedValue(new Error('forbidden'));

        await expect(addon.apply({ apiVersion: 'v1', kind: 'Namespace', metadata: { name: 'agent-sandbox-system' } }))
            .resolves.toMatchObject({ status: 'failed', error: 'forbidden' });
    });

    it('treats a missing resource as an already successful delete', async () => {
        vi.mocked(k3s.deleteResource).mockRejectedValue(Object.assign(new Error('Not Found'), { code: 404 }));

        await expect(addon.delete({ apiVersion: 'v1', kind: 'Namespace', metadata: { name: 'agent-sandbox-system' } }))
            .resolves.toMatchObject({ status: 'succeeded' });
    });
});
