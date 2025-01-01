import k3s from "../adapter/kubernetes-api.adapter";
import * as k8s from '@kubernetes/client-node';
import { NodeInfoModel } from "@/shared/model/node-info.model";
import { NodeResourceModel } from "@/shared/model/node-resource.model";
import { Tags } from "../utils/cache-tag-generator.utils";
import { revalidateTag, unstable_cache } from "next/cache";
import longhornApiAdapter from "../adapter/longhorn-api.adapter";
import { KubernetesSizeConverter } from "../utils/kubernetes-size-converter.utils";

class ClusterService {

    async getNodeInfo(): Promise<NodeInfoModel[]> {
        return await unstable_cache(async () => {
            const nodeReturnInfo = await k3s.core.listNode();
            return nodeReturnInfo.body.items.map((node) => {
                return {
                    name: node.metadata?.name!,
                    status: node.status?.conditions?.filter((condition) => condition.type === 'Ready')[0].status!,
                    os: node.status?.nodeInfo?.osImage!,
                    architecture: node.status?.nodeInfo?.architecture!,
                    cpuCapacity: node.status?.capacity?.cpu!,
                    ramCapacity: node.status?.capacity?.memory!,
                    ip: node.status?.addresses?.filter((address) => address.type === 'InternalIP')[0].address!,
                    kernelVersion: node.status?.nodeInfo?.kernelVersion!,
                    containerRuntimeVersion: node.status?.nodeInfo?.containerRuntimeVersion!,
                    kubeProxyVersion: node.status?.nodeInfo?.kubeProxyVersion!,
                    kubeletVersion: node.status?.nodeInfo?.kubeletVersion!,
                    isMasterNode: node.metadata?.labels?.['node-role.kubernetes.io/master'] === 'true',

                    memoryOk: node.status?.conditions?.filter((condition) => condition.type === 'MemoryPressure')[0].status === 'False',
                    memoryStatusText: node.status?.conditions?.filter((condition) => condition.type === 'MemoryPressure')[0].message,
                    diskOk: node.status?.conditions?.filter((condition) => condition.type === 'DiskPressure')[0].status === 'False',
                    diskStatusText: node.status?.conditions?.filter((condition) => condition.type === 'DiskPressure')[0].message,
                    pidOk: node.status?.conditions?.filter((condition) => condition.type === 'PIDPressure')[0].status === 'False',
                    pidStatusText: node.status?.conditions?.filter((condition) => condition.type === 'PIDPressure')[0].message,
                    schedulable: !node.spec?.unschedulable
                }
            });
        },
            [Tags.nodeInfos()], {
            revalidate: 10,
            tags: [Tags.nodeInfos()]
        })();
    }

    async getMasterNode(): Promise<NodeInfoModel> {
        const nodes = await this.getNodeInfo();
        return nodes.find(node => node.isMasterNode)!;
    }

    async setNodeStatus(nodeName: string, schedulable: boolean) {
        try {
            await k3s.core.patchNode(nodeName, { "spec": { "unschedulable": schedulable ? null : true } }, undefined, undefined, undefined, undefined, undefined, {
                headers: { 'Content-Type': 'application/strategic-merge-patch+json' },
            });

            if (!schedulable) {
                // delete all pods on node
                const pods = await k3s.core.listPodForAllNamespaces();
                for (const pod of pods.body.items) {
                    if (pod.spec?.nodeName === nodeName) {
                        await k3s.core.deleteNamespacedPod(pod.metadata?.name!, pod.metadata?.namespace!);
                    }
                }
            }
        } finally {
            revalidateTag(Tags.nodeInfos());
        }
    }

    async getNodeResourceUsage(): Promise<NodeResourceModel[]> {
        const topNodes = await k8s.topNodes(k3s.core);

        const metricsData: k8s.NodeMetricsList = await k3s.metrics.getNodeMetrics();

        return await Promise.all(topNodes.map(async (node) => {
            const nodeMetrics = metricsData.items.filter((metric) => metric.metadata.name === node.Node.metadata?.name)
                .map((metric) => {
                    return {
                        timestamp: new Date(metric.timestamp),
                        cpuUsage: KubernetesSizeConverter.fromNanoCpu(KubernetesSizeConverter.toNanoCpu(metric.usage.cpu)),
                        ramUsage: KubernetesSizeConverter.toBytes(metric.usage.memory)
                    }
                });

            // sorted by timestamp descending
            nodeMetrics.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
            const latestUsageItem = nodeMetrics[0];

            const diskInfo = await longhornApiAdapter.getNodeStorageInfo(node.Node.metadata?.name!);

            return {
                name: node.Node.metadata?.name!,
                cpuUsage: latestUsageItem.cpuUsage,
                cpuCapacity: Number(node.CPU?.Capacity!),
                ramUsage: latestUsageItem.ramUsage,
                ramCapacity: Number(node.Memory?.Capacity!),
                diskUsageAbsolut: diskInfo.totalStorageMaximum - diskInfo.totalStorageAvailable,
                diskUsageReserved: diskInfo.totalStorageReserved,
                diskUsageCapacity: diskInfo.totalStorageMaximum,
                diskSpaceSchedulable: diskInfo.totalSchedulableStorage
            }
        }));
    }
}

const clusterService = new ClusterService();
export default clusterService;
