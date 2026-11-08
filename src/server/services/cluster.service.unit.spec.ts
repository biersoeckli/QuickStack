vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn, revalidateTag: vi.fn() }));



const mocks = vi.hoisted(() => ({ topNodes: vi.fn(), getNodeMetrics: vi.fn(), getNodeSummary: vi.fn(), getPersistentVolumeClaims: vi.fn() }));
vi.mock('@kubernetes/client-node', async (importOriginal) => ({
    ...await importOriginal<typeof import('@kubernetes/client-node')>(),
    topNodes: mocks.topNodes,
}));
vi.mock('@/server/adapter/kubernetes-api.adapter', () => ({
    default: { core: {}, metrics: { getNodeMetrics: mocks.getNodeMetrics }, getNodeSummary: mocks.getNodeSummary },
    kubernetesPatchOptions: vi.fn(),
}));
vi.mock('@/server/adapter/volume-summary.adapter', () => ({
    default: { getPersistentVolumeClaims: mocks.getPersistentVolumeClaims },
}));
import clusterService from './cluster.service';

describe('cluster node storage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.topNodes.mockResolvedValue(['node-a', 'node-b'].map(name => ({
            Node: { metadata: { name } }, CPU: { Capacity: '2' }, Memory: { Capacity: '1000' },
        })));
        mocks.getNodeMetrics.mockResolvedValue({ items: ['node-a', 'node-b'].map(name => ({
            metadata: { name }, timestamp: new Date().toISOString(), usage: { cpu: '1000000n', memory: '100Mi' },
        })) });
    });

    it('returns filesystem metrics and preserves other nodes when a summary fails', async () => {
        mocks.getNodeSummary.mockImplementation(async (name: string) => {
            if (name === 'node-b') throw new Error('unavailable');
            return { node: { fs: { time: new Date().toISOString(), usedBytes: 300, availableBytes: 600, capacityBytes: 1000 } } };
        });
        const nodes = await clusterService.getNodeResourceUsage();
        expect(nodes[0]).toMatchObject({ name: 'node-a', diskUsageAbsolut: 300, diskUsageAvailable: 600, diskUsageCapacity: 1000 });
        expect(nodes[1].diskUsageCapacity).toBeUndefined();
    });

    it('does not present stale or incomplete filesystem measurements', async () => {
        mocks.getNodeSummary.mockImplementation(async (name: string) => ({ node: { fs: name === 'node-a'
            ? { time: '2000-01-01T00:00:00Z', usedBytes: 10, availableBytes: 90, capacityBytes: 100 }
            : { time: new Date().toISOString(), usedBytes: 10, capacityBytes: 100 },
        } }));
        const nodes = await clusterService.getNodeResourceUsage();
        expect(nodes.map(node => node.diskUsageCapacity)).toEqual([undefined, undefined]);
    });
});

describe('reserved volume storage', () => {
    it('sums requested storage across all claims', async () => {
        mocks.getPersistentVolumeClaims.mockResolvedValue([
            { spec: { resources: { requests: { storage: '2Gi' } } } },
            { spec: { resources: { requests: { storage: '512Mi' } } } },
            { spec: {} },
        ]);

        expect(await clusterService.getReservedVolumeStorage()).toBe(2684354560);
    });
});
