import k3s from './kubernetes-api.adapter';

export interface VolumeFilesystemSample {
  pvcRef?: { namespace?: string; name?: string };
  time?: string;
  usedBytes?: number;
  availableBytes?: number;
  capacityBytes?: number;
}

interface NodeSummary {
  pods?: { volume?: VolumeFilesystemSample[] }[];
}

class VolumeSummaryAdapter {
  async getPersistentVolumeClaims() {
    return (await k3s.core.listPersistentVolumeClaimForAllNamespaces()).items;
  }

  async getPersistentVolumes() {
    return (await k3s.core.listPersistentVolume()).items;
  }

  async getSamples(getNodeSummary: (nodeName: string) => Promise<unknown> = (nodeName) => k3s.getNodeSummary(nodeName)): Promise<VolumeFilesystemSample[]> {
    const nodes = await k3s.core.listNode();
    const summaries = await Promise.allSettled(
      nodes.items.map(async (node) => {
        if (!node.metadata?.name) return [];
        const summary = (await getNodeSummary(node.metadata.name)) as NodeSummary;
        return summary.pods?.flatMap((pod) => pod.volume ?? []) ?? [];
      })
    );
    return summaries.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
  }
}

const volumeSummaryAdapter = new VolumeSummaryAdapter();
export default volumeSummaryAdapter;
