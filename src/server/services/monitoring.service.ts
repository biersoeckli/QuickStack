import k3s from "../adapter/kubernetes-api.adapter";
import * as k8s from '@kubernetes/client-node';
import standalonePodService from "./standalone-services/standalone-pod.service";
import clusterService from "./cluster.service";
import { PodsResourceInfoModel } from "@/shared/model/pods-resource-info.model";
import { KubeSizeConverter } from "../../shared/utils/kubernetes-size-converter.utils";
import { AppVolumeMonitoringUsageModel } from "@/shared/model/app-volume-monitoring-usage.model";
import longhornApiAdapter from "../adapter/longhorn-api.adapter";
import dataAccess from "../adapter/db.client";
import pvcService from "./pvc.service";
import { KubeObjectNameUtils } from "../utils/kube-object-name.utils";
import projectService from "./project.service";
import { AppMonitoringUsageModel } from "@/shared/model/app-monitoring-usage.model";

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
        const volumeMap = new Map(appVolumes.map(volume => [volume.id, volume]));
        const pvcByName = new Map(pvcs.map(pvc => [pvc.metadata?.name, pvc]));
        const longhornVolumeByName = new Map(longhornData.map(volume => [volume.name, volume]));

        for (const appVolume of appVolumes) {
            const sharedVolumeId = (appVolume as { sharedVolumeId?: string | null }).sharedVolumeId;
            const baseVolumeId = sharedVolumeId ?? appVolume.id;
            const baseVolume = volumeMap.get(baseVolumeId);
            const pvc = pvcByName.get(KubeObjectNameUtils.toPvcName(baseVolumeId));
            if (!pvc) {
                continue;
            }
            const volumeName = pvc.spec?.volumeName;
            const longhornVolume = volumeName ? longhornVolumeByName.get(volumeName) : undefined;
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
                capacityBytes: KubeSizeConverter.fromMegabytesToBytes(baseVolume?.size ?? appVolume.size),
                isBaseVolume: !sharedVolumeId
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

    async getMonitoringForAllApps() {
        const [topPods, totalResourcesNodes, projects] = await Promise.all([
            k8s.topPods(k3s.core, new k8s.Metrics(k3s.getKubeConfig())),
            this.getTotalAvailableNodeRessources(),
            projectService.getAll()
        ]);

        const topPodsByApp = this.groupTopPodsByApp(topPods);
        const appStats: AppMonitoringUsageModel[] = [];

        for (let project of projects) {
            for (let app of project.apps) {
                const filteredTopPods = topPodsByApp.get(MonitorService.appPodKey(project.id, app.id)) ?? [];
                const totalResourcesApp = this.calulateTotalRessourceUsageOfApp(filteredTopPods);
                const cpuUsagePercent = (totalResourcesApp.cpu / totalResourcesNodes.cpu) * 100;
                appStats.push({
                    projectId: project.id,
                    projectName: project.name,
                    appName: app.name,
                    appId: app.id,
                    cpuUsage: totalResourcesApp.cpu,
                    cpuUsagePercent,
                    ramUsageBytes: totalResourcesApp.ramBytes
                })
            }
        }
        appStats.sort((a, b) => {
            if (a.projectName === b.projectName) {
                return a.appName.localeCompare(b.appName);
            }
            return a.projectName.localeCompare(b.projectName);
        });
        return appStats;
    }

    /**
     * Groups the cluster-wide pod metrics by the namespace and the `app` label,
     * so each app's pods can be looked up in constant time without listing pods per app.
     */
    private groupTopPodsByApp(topPods: k8s.PodStatus[]): Map<string, k8s.PodStatus[]> {
        const topPodsByApp = new Map<string, k8s.PodStatus[]>();
        for (const topPod of topPods) {
            const namespace = topPod.Pod.metadata?.namespace;
            const appId = topPod.Pod.metadata?.labels?.['app'];
            if (!namespace || !appId) {
                continue;
            }
            const key = MonitorService.appPodKey(namespace, appId);
            const pods = topPodsByApp.get(key);
            if (pods) {
                pods.push(topPod);
            } else {
                topPodsByApp.set(key, [topPod]);
            }
        }
        return topPodsByApp;
    }

    private static appPodKey(namespace: string, appId: string): string {
        return `${namespace}/${appId}`;
    }

    async getMonitoringForApp(projectId: string, appId: string): Promise<PodsResourceInfoModel> {
        const metricsClient = new k8s.Metrics(k3s.getKubeConfig());
        const podsFromApp = await standalonePodService.getPodsForApp(projectId, appId);
        const topPods = await k8s.topPods(k3s.core, metricsClient, projectId);

        const filteredTopPods = topPods.filter((topPod) =>
            podsFromApp.some((pod) => pod.podName === topPod.Pod.metadata?.name)
        );

        const totalResourcesNodes = await this.getTotalAvailableNodeRessources();
        const totalResourcesApp = this.calulateTotalRessourceUsageOfApp(filteredTopPods);

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

    private calulateTotalRessourceUsageOfApp(filteredTopPods: k8s.PodStatus[]) {
        return filteredTopPods.reduce(
            (acc, pod) => {
                acc.cpu += Number(pod.CPU.CurrentUsage) || 0;
                acc.ramBytes += Number(pod.Memory.CurrentUsage) || 0;
                return acc;
            },
            { cpu: 0, ramBytes: 0 }
        );
    }

    private async getTotalAvailableNodeRessources() {
        const topNodes = await clusterService.getNodeInfo();
        const totalResourcesNodes = topNodes.reduce(
            (acc, node) => {
                acc.cpu += Number(node.cpuCapacity) || 0;
                acc.ramBytes += KubeSizeConverter.fromKubeSizeToBytes(node.ramCapacity) || 0;
                return acc;
            },
            { cpu: 0, ramBytes: 0 }
        );
        return totalResourcesNodes;
    }

    async getPvcUsageFromApp(appId: string, projectId: string): Promise<Array<{ pvcName: string, usedBytes: number }>> {
        const appVolumes = await dataAccess.client.appVolume.findMany({
            where: {
                appId
            },
            select: {
                id: true,
                sharedVolumeId: true
            }
        });
        if (appVolumes.length === 0) {
            return [];
        }
        const baseVolumeIds = Array.from(new Set(appVolumes.map(volume => (volume as { sharedVolumeId?: string | null }).sharedVolumeId || volume.id)));
        const pvcNames = new Set(baseVolumeIds.map(id => KubeObjectNameUtils.toPvcName(id)));
        const pvcFromProject = await k3s.core.listNamespacedPersistentVolumeClaim({ namespace: projectId });
        const pvcUsageData: Array<{ pvcName: string, usedBytes: number }> = [];

        for (const pvc of pvcFromProject.items) {
            const pvcName = pvc.metadata?.name;
            const volumeName = pvc.spec?.volumeName;

            if (pvcName && volumeName && pvcNames.has(pvcName as `pvc-${string}`)) {
                const usedBytes = await longhornApiAdapter.getLonghornVolume(volumeName);
                pvcUsageData.push({ pvcName, usedBytes });
            }
        }
        return pvcUsageData;
    }
}

const monitoringService = new MonitorService();
export default monitoringService;
