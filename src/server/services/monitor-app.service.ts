import k3s from "../adapter/kubernetes-api.adapter";
import * as k8s from '@kubernetes/client-node';
import standalonePodService from "./standalone-services/standalone-pod.service";
import clusterService from "./node.service";
import { PodsResourceInfoModel } from "@/shared/model/pods-resource-info.model";
import { KubernetesSizeConverter } from "../utils/kubernetes-size-converter.utils";

class MonitorAppService {
    async getMonitoringForApp(projectId: string, appId: string): Promise<PodsResourceInfoModel> {
        const metricsClient = new k8s.Metrics(k3s.getKubeConfig());
        const podsFromApp = await standalonePodService.getPodsForApp(projectId, appId);
        const topPods = await k8s.topPods(k3s.core, metricsClient, projectId);

        const filteredTopPods = topPods.filter((topPod) =>
            podsFromApp.some((pod) => pod.podName === topPod.Pod.metadata?.name)
        );

        const topNodes = await clusterService.getNodeInfo();
        const totalResourcesNodes = topNodes.reduce(
            (acc, node) => {
                acc.cpu += Number(node.cpuCapacity) || 0;
                acc.ramBytes += KubernetesSizeConverter.toBytes(node.ramCapacity) || 0;
                return acc;
            },
            { cpu: 0, ramBytes: 0 }
        );

        const totalResourcesApp = filteredTopPods.reduce(
            (acc, pod) => {
                acc.cpu += Number(pod.CPU.CurrentUsage) || 0;
                acc.ramBytes += Number(pod.Memory.CurrentUsage) || 0;
                return acc;
            },
            { cpu: 0, ramBytes: 0 }
        );


        var totalRamNodesCorrectUnit: number = totalResourcesNodes.ramBytes;
        var totalRamAppCorrectUnit: number = totalResourcesApp.ramBytes;

        const appCpuUsagePercent = ((totalResourcesApp.cpu / totalResourcesNodes.cpu) * 100);
        const appRamUsagePercent = ((totalRamAppCorrectUnit / totalRamNodesCorrectUnit) * 100);

        return {
            cpuPercent: appCpuUsagePercent,
            cpuAbsolut: totalResourcesApp.cpu,
            ramPercent: appRamUsagePercent,
            ramAbsolut: totalRamAppCorrectUnit
        }
    }

}

const monitorAppService = new MonitorAppService();
export default monitorAppService;
