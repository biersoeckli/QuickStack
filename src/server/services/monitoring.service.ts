import k3s from "../adapter/kubernetes-api.adapter";
import * as k8s from '@kubernetes/client-node';
import standalonePodService from "./standalone-services/standalone-pod.service";
import clusterService from "./node.service";
import { PodsResourceInfoModel } from "@/shared/model/pods-resource-info.model";
import { KubeSizeConverter } from "../../shared/utils/kubernetes-size-converter.utils";
import { AppVolumeMonitoringUsageModel } from "@/shared/model/app-volume-monitoring-usage.model";
import longhornApiAdapter from "../adapter/longhorn-api.adapter";
import dataAccess from "../adapter/db.client";
import pvcService from "./pvc.service";
import { KubeObjectNameUtils } from "../utils/kube-object-name.utils";

class MonitorService {

    async getAllAppVolumesUsage() {
        const [longhornData, appVolumes, pvcs] = await Promise.all([
            longhornApiAdapter.getAllLonghornVolumes(),
            dataAccess.client.appVolume.findMany({
                include: {
                    app: {
                        include: {
                            project: true
                        }
                    }
                },
                orderBy: {
                    appId: 'asc'
                }
            }),
            pvcService.getAllPvc()
        ]);

        const appVolumesWithUsage: AppVolumeMonitoringUsageModel[] = [];

        for (const appVolume of appVolumes) {

            const pvc = pvcs.find(pvc => pvc.metadata?.name === KubeObjectNameUtils.toPvcName(appVolume.id));
            if (!pvc) {
                continue;
            }
            const volumeName = pvc.spec?.volumeName;
            const longhornVolume = longhornData.find(volume => volume.name === volumeName);
            if (!longhornVolume) {
                continue;
            }

            appVolumesWithUsage.push({
                projectId: appVolume.app.projectId,
                projectName: appVolume.app.project.name,
                appName: appVolume.app.name,
                appId: appVolume.appId,
                mountPath: appVolume.containerMountPath,
                usedBytes: longhornVolume.actualSizeBytes,
                capacityBytes: KubeSizeConverter.fromMegabytesToBytes(appVolume.size),
            });
        }

        // sort appVolumesWithUsage first by projectName (asc) then by appName
        appVolumesWithUsage.sort((a, b) => {
            if (a.projectName === b.projectName) {
                return a.appName.localeCompare(b.appName);
            }
            return a.projectName.localeCompare(b.projectName);
        });
        return appVolumesWithUsage;
    }

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
                acc.ramBytes += KubeSizeConverter.fromKubeSizeToBytes(node.ramCapacity) || 0;
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
            cpuAbsolutCores: totalResourcesApp.cpu,
            ramPercent: appRamUsagePercent,
            ramAbsolutBytes: totalRamAppCorrectUnit
        }
    }

    async getPvcUsageFromApp(appId: string, projectId: string): Promise<Array<{ pvcName: string, usedBytes: number }>> {
        const pvcFromApp = await pvcService.getAllPvcForApp(projectId, appId);
        const pvcUsageData: Array<{ pvcName: string, usedBytes: number }> = [];

        for (const pvc of pvcFromApp) {
            const pvcName = pvc.metadata?.name;
            const volumeName = pvc.spec?.volumeName;

            if (pvcName && volumeName) {

                const usedBytes = await longhornApiAdapter.getLonghornVolume(volumeName);
                pvcUsageData.push({ pvcName, usedBytes });
            }
        }
        return pvcUsageData;
    }
}

const monitoringService = new MonitorService();
export default monitoringService;
