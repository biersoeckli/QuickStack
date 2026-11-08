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
    async getSamples(): Promise<VolumeFilesystemSample[]> {
        const nodes = await k3s.core.listNode();
        const summaries = await Promise.allSettled(nodes.items.map(async node => {
            if (!node.metadata?.name) return [];
            const raw = await k3s.core.connectGetNodeProxyWithPath({ name: node.metadata.name, path: 'stats/summary' });
            const summary: NodeSummary = typeof raw === 'string' ? JSON.parse(raw) : raw;
            return summary.pods?.flatMap(pod => pod.volume ?? []) ?? [];
        }));
        return summaries.flatMap(result => result.status === 'fulfilled' ? result.value : []);
    }
}

const volumeSummaryAdapter = new VolumeSummaryAdapter();
export default volumeSummaryAdapter;
