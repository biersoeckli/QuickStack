import nodeResourceAdapter from '@/server/adapter/node-resource.adapter';
import * as k8s from '@kubernetes/client-node';
import { KubeSizeConverter } from '@/shared/utils/kubernetes-size-converter.utils';
import { NodeResourceModel } from '@/shared/model/node-resource.model';

type NodeMonitoringResource = Omit<NodeResourceModel, 'cpuUsage' | 'ramUsage'> & { cpuUsage: number | null; ramUsage: number | null };

class NodeResourceService {
  private isFresh(timestamp: number): boolean {
    const age = Date.now() - timestamp;
    return Number.isFinite(timestamp) && age <= 5 * 60_000 && age >= -60_000;
  }

  private isValidDiskValue(value: number | undefined): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0;
  }

  async getNodeResourceUsage(
    getSummary: (name: string) => Promise<unknown> = (name) => nodeResourceAdapter.getSummary(name)
  ): Promise<NodeMonitoringResource[]> {
    const topNodes = await nodeResourceAdapter.getNodes();

    const metricsData: k8s.NodeMetricsList = await nodeResourceAdapter.getMetrics().catch((error) => {
      console.error('Failed to fetch node metrics:', error);
      return { items: [] } as unknown as k8s.NodeMetricsList;
    });

    return await Promise.all(
      topNodes.map(async (node) => {
        const metric = metricsData.items
          .filter((item) => item.metadata.name === node.Node.metadata?.name)
          .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))[0];
        const timestamp = Date.parse(metric?.timestamp ?? '');
        const fresh = this.isFresh(timestamp);
        const convert = (value: string | undefined, converter: (input: string) => number): number | null => {
          try {
            if (!fresh || !value) {
              return null;
            }
            const result = converter(value);
            return Number.isFinite(result) && result >= 0 ? result : null;
          } catch {
            return null;
          }
        };
        const cpuUsage = convert(metric?.usage?.cpu, (value) => KubeSizeConverter.fromNanoToFullCpu(KubeSizeConverter.fromKubeSizeToNanoCpu(value)));
        const ramUsage = convert(metric?.usage?.memory, (value) =>
          /^\d+(?:\.\d+)?$/.test(value) ? Number(value) : KubeSizeConverter.fromKubeSizeToBytes(value)
        );

        let filesystem: { usedBytes?: number; availableBytes?: number; capacityBytes?: number; time?: string } | undefined;
        try {
          const summary = (await getSummary(node.Node.metadata?.name!)) as { node?: { fs?: typeof filesystem } };
          const fs = summary.node?.fs;
          const timestamp = Date.parse(fs?.time ?? '');
          if (
            fs &&
            this.isFresh(timestamp) &&
            this.isValidDiskValue(fs.usedBytes) &&
            this.isValidDiskValue(fs.availableBytes) &&
            this.isValidDiskValue(fs.capacityBytes) &&
            fs.capacityBytes > 0 &&
            fs.usedBytes <= fs.capacityBytes &&
            fs.availableBytes <= fs.capacityBytes
          ) {
            filesystem = fs;
          }
        } catch (error) {
          console.error(`Failed to fetch summary for node ${node.Node.metadata?.name}:`, error);
        }

        const measuredTimes = [...(cpuUsage !== null || ramUsage !== null ? [timestamp] : []), ...(filesystem?.time ? [Date.parse(filesystem.time)] : [])];
        return {
          measuredAt: measuredTimes.length ? new Date(Math.min(...measuredTimes)) : null,
          name: node.Node.metadata?.name!,
          cpuUsage: cpuUsage,
          cpuCapacity: Number(node.CPU?.Capacity!),
          ramUsage: ramUsage,
          ramCapacity: Number(node.Memory?.Capacity!),
          diskUsageAbsolut: filesystem?.usedBytes,
          diskUsageAvailable: filesystem?.availableBytes,
          diskUsageCapacity: filesystem?.capacityBytes
        };
      })
    );
  }
}
const nodeResourceService = new NodeResourceService();
export default nodeResourceService;
