import k3s from '@/server/adapter/kubernetes-api.adapter';
import * as k8s from '@kubernetes/client-node';
import { KubeSizeConverter } from '@/shared/utils/kubernetes-size-converter.utils';
import { NodeResourceModel } from '@/shared/model/node-resource.model';

type NodeMonitoringResource = Omit<NodeResourceModel, 'cpuUsage' | 'ramUsage'> & { cpuUsage: number | null; ramUsage: number | null };

class NodeResourceService {
  async getNodeResourceUsage(getSummary: (name: string) => Promise<unknown> = (name) => k3s.getNodeSummary(name)): Promise<NodeMonitoringResource[]> {
    const topNodes = await k8s.topNodes(k3s.core);

    const metricsData: k8s.NodeMetricsList = await k3s.metrics.getNodeMetrics().catch(() => ({ items: [] }) as unknown as k8s.NodeMetricsList);

    return await Promise.all(
      topNodes.map(async (node) => {
        const nodeMetrics = metricsData.items
          .filter((metric) => metric.metadata.name === node.Node.metadata?.name)
          .map((metric) => {
            return {
              timestamp: new Date(metric.timestamp),
              cpuUsage: KubeSizeConverter.fromNanoToFullCpu(KubeSizeConverter.fromKubeSizeToNanoCpu(metric.usage.cpu)),
              ramUsage: KubeSizeConverter.fromKubeSizeToBytes(metric.usage.memory)
            };
          });

        // sorted by timestamp descending
        nodeMetrics.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        const latestUsageItem = nodeMetrics[0];

        let filesystem: { usedBytes?: number; availableBytes?: number; capacityBytes?: number; time?: string } | undefined;
        try {
          const summary = (await getSummary(node.Node.metadata?.name!)) as { node?: { fs?: typeof filesystem } };
          const fs = summary.node?.fs;
          const timestamp = Date.parse(fs?.time ?? '');
          if (
            fs &&
            Number.isFinite(timestamp) &&
            timestamp <= Date.now() &&
            Date.now() - timestamp <= 5 * 60_000 &&
            typeof fs.usedBytes === 'number' &&
            Number.isFinite(fs.usedBytes) &&
            fs.usedBytes >= 0 &&
            typeof fs.availableBytes === 'number' &&
            Number.isFinite(fs.availableBytes) &&
            fs.availableBytes >= 0 &&
            typeof fs.capacityBytes === 'number' &&
            Number.isFinite(fs.capacityBytes) &&
            fs.capacityBytes > 0 &&
            fs.usedBytes <= fs.capacityBytes &&
            fs.availableBytes <= fs.capacityBytes
          ) {
            filesystem = fs;
          }
        } catch {
          // A node without a summary must not hide the other nodes' metrics.
        }

        return {
          name: node.Node.metadata?.name!,
          cpuUsage: latestUsageItem?.cpuUsage ?? null,
          cpuCapacity: Number(node.CPU?.Capacity!),
          ramUsage: latestUsageItem?.ramUsage ?? null,
          ramCapacity: Number(node.Memory?.Capacity!),
          diskUsageAbsolut: filesystem?.usedBytes,
          diskUsageAvailable: filesystem?.availableBytes,
          diskUsageCapacity: filesystem?.capacityBytes
        };
      })
    );
  }
}
export default new NodeResourceService();
