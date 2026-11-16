vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn, revalidateTag: vi.fn() }));

const mocks = vi.hoisted(() => ({ topNodes: vi.fn(), getNodeMetrics: vi.fn(), getNodeSummary: vi.fn(), getPersistentVolumeClaims: vi.fn() }));
vi.mock('@kubernetes/client-node', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@kubernetes/client-node')>()),
  topNodes: mocks.topNodes
}));
vi.mock('@/server/adapter/kubernetes-api.adapter', () => ({
  default: { core: {}, metrics: { getNodeMetrics: mocks.getNodeMetrics }, getNodeSummary: mocks.getNodeSummary },
  kubernetesPatchOptions: vi.fn()
}));
vi.mock('@/server/adapter/volume-summary.adapter', () => ({ default: { getPersistentVolumeClaims: mocks.getPersistentVolumeClaims } }));
import clusterService from './cluster.service';

describe('cluster node storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.topNodes.mockResolvedValue(
      ['node-a', 'node-b'].map((name) => ({ Node: { metadata: { name } }, CPU: { Capacity: '2' }, Memory: { Capacity: '1000' } }))
    );
    mocks.getNodeMetrics.mockResolvedValue({
      items: ['node-a', 'node-b'].map((name) => ({ metadata: { name }, timestamp: new Date().toISOString(), usage: { cpu: '1000000n', memory: '100Mi' } }))
    });
  });

  it('returns filesystem metrics and preserves other nodes when a summary fails', async () => {
    mocks.getNodeSummary.mockImplementation(async (name: string) => {
      if (name === 'node-b') {
        throw new Error('unavailable');
      }
      return { node: { fs: { time: new Date().toISOString(), usedBytes: 300, availableBytes: 600, capacityBytes: 1000 } } };
    });
    const nodes = await clusterService.getNodeResourceUsage();
    expect(nodes[0]).toMatchObject({ name: 'node-a', diskUsageAbsolut: 300, diskUsageAvailable: 600, diskUsageCapacity: 1000 });
    expect(nodes[1].diskUsageCapacity).toBeUndefined();
  });

  it('keeps each node and valid metrics when one CPU measurement is missing', async () => {
    mocks.getNodeSummary.mockResolvedValue({ node: { fs: { time: new Date().toISOString(), usedBytes: 10, availableBytes: 90, capacityBytes: 100 } } });
    mocks.getNodeMetrics.mockResolvedValue({
      items: [
        { metadata: { name: 'node-a' }, timestamp: new Date().toISOString(), usage: { cpu: 'invalid', memory: '1234' } },
        { metadata: { name: 'node-b' }, timestamp: '2000-01-01T00:00:00Z', usage: { cpu: '1', memory: '100Mi' } }
      ]
    });
    const nodes = await clusterService.getNodeResourceUsage();
    expect(nodes[0]).toMatchObject({ cpuUsage: null, ramUsage: 1234, diskUsageAbsolut: 10 });
    expect(nodes[1]).toMatchObject({ cpuUsage: null, ramUsage: null, diskUsageAbsolut: 10 });
  });

  it('reports the oldest source timestamp among valid node measurements', async () => {
    const metricTime = new Date(Date.now() - 60_000).toISOString();
    const filesystemTime = new Date(Date.now() - 120_000).toISOString();
    mocks.getNodeMetrics.mockResolvedValue({ items: [{ metadata: { name: 'node-a' }, timestamp: metricTime, usage: { cpu: '1', memory: '100Mi' } }] });
    mocks.getNodeSummary.mockResolvedValue({ node: { fs: { time: filesystemTime, usedBytes: 10, availableBytes: 90, capacityBytes: 100 } } });
    const nodes = await clusterService.getNodeResourceUsage();
    expect(nodes[0].measuredAt).toEqual(new Date(filesystemTime));
    expect(nodes[1].measuredAt).toEqual(new Date(filesystemTime));
  });

  it('accepts timestamps within one minute of clock skew and rejects later timestamps', async () => {
    const now = Date.now();
    mocks.getNodeMetrics.mockResolvedValue({
      items: ['node-a', 'node-b'].map((name, index) => ({
        metadata: { name }, timestamp: new Date(now + (index ? 61_000 : 30_000)).toISOString(), usage: { cpu: '1', memory: '100Mi' }
      }))
    });
    mocks.getNodeSummary.mockImplementation(async (name: string) => ({
      node: { fs: { time: new Date(now + (name === 'node-a' ? 30_000 : 61_000)).toISOString(), usedBytes: 10, availableBytes: 90, capacityBytes: 100 } }
    }));
    const nodes = await clusterService.getNodeResourceUsage();
    expect(nodes[0]).toMatchObject({ cpuUsage: expect.any(Number), ramUsage: expect.any(Number), diskUsageCapacity: 100 });
    expect(nodes[1]).toMatchObject({ cpuUsage: null, ramUsage: null, diskUsageCapacity: undefined });
  });

  it('logs metrics and summary failures while returning available nodes', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const metricsError = new Error('metrics unavailable');
    const summaryError = new Error('summary unavailable');
    mocks.getNodeMetrics.mockRejectedValue(metricsError);
    mocks.getNodeSummary.mockRejectedValue(summaryError);
    try {
      const nodes = await clusterService.getNodeResourceUsage();
      expect(nodes).toHaveLength(2);
      expect(nodes[0]).toMatchObject({ cpuUsage: null, ramUsage: null, diskUsageCapacity: undefined });
      expect(log).toHaveBeenCalledWith('Failed to fetch node metrics:', metricsError);
      expect(log).toHaveBeenCalledWith('Failed to fetch summary for node node-a:', summaryError);
    } finally {
      log.mockRestore();
    }
  });

  it('does not present stale or incomplete filesystem measurements', async () => {
    mocks.getNodeSummary.mockImplementation(async (name: string) => ({
      node: {
        fs:
          name === 'node-a'
            ? { time: '2000-01-01T00:00:00Z', usedBytes: 10, availableBytes: 90, capacityBytes: 100 }
            : { time: new Date().toISOString(), usedBytes: 10, capacityBytes: 100 }
      }
    }));
    const nodes = await clusterService.getNodeResourceUsage();
    expect(nodes.map((node) => node.diskUsageCapacity)).toEqual([undefined, undefined]);
  });
});

describe('reserved volume storage', () => {
  it('sums requested storage across all claims', async () => {
    mocks.getPersistentVolumeClaims.mockResolvedValue([
      { spec: { resources: { requests: { storage: '2Gi' } } } },
      { spec: { resources: { requests: { storage: '512Mi' } } } },
      { spec: {} }
    ]);

    expect(await clusterService.getReservedVolumeStorage()).toBe(2684354560);
  });
});
