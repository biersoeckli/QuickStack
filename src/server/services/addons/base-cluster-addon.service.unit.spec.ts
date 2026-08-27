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
    constructor(addonId = 'test') {
        super(addonId);
    }

    list() {
        return this.listResources('example.test', 'v1', 'examples');
    }

    apply(spec: any) {
        return this.applyResource(spec);
    }

    delete(spec: any) {
        return this.deleteResource(spec);
    }

    run<T>(operation: 'installing' | 'updating' | 'uninstalling', fn: () => Promise<T>) {
        return this.runExclusive(operation, fn);
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

    it('claims the operation lock before asynchronous work starts', async () => {
        let release!: () => void;
        const first = addon.run('installing', () => new Promise<void>((resolve) => { release = resolve; }));

        await expect(addon.run('updating', async () => undefined)).rejects.toThrow('An operation is already in progress.');

        release();
        await expect(first).resolves.toBeUndefined();
    });

    it('shares operation locks between instances for the same add-on', async () => {
        const secondInstance = new TestClusterAddon();
        let release!: () => void;
        const first = addon.run('installing', () => new Promise<void>((resolve) => { release = resolve; }));

        await expect(secondInstance.run('updating', async () => undefined)).rejects.toThrow('An operation is already in progress.');

        release();
        await expect(first).resolves.toBeUndefined();
    });
});
