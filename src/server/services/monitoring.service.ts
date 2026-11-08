import k3s from "../adapter/kubernetes-api.adapter";
import * as k8s from '@kubernetes/client-node';
import standalonePodService from "./standalone-services/standalone-pod.service";
import clusterService from "./cluster.service";
import { PodsResourceInfoModel } from "@/shared/model/pods-resource-info.model";
import { KubeSizeConverter } from "../../shared/utils/kubernetes-size-converter.utils";
import { AppVolumeMonitoringUsageModel } from "@/shared/model/app-volume-monitoring-usage.model";
import volumeSummaryAdapter from "../adapter/volume-summary.adapter";
import { supportsVolumeFilesystemMetrics } from "./volume-filesystem-drivers";
import { VolumeFilesystemUsage } from "@/shared/model/app-volume-monitoring-usage.model";
import dataAccess from "../adapter/db.client";
import pvcService from "./pvc.service";
import { KubeObjectNameUtils } from "../utils/kube-object-name.utils";
import projectService from "./project.service";
import { AppMonitoringUsageModel } from "@/shared/model/app-monitoring-usage.model";

class MonitorService {

    private async getVolumeFilesystemUsage(
        volumes: { id: string; sharedVolumeId: string | null; projectId: string }[],
    ): Promise<Map<string, VolumeFilesystemUsage>> {
        const [pvcs, persistentVolumes, samples] = await Promise.all([
            pvcService.getAllPvc().catch(() => []),
            volumeSummaryAdapter.getPersistentVolumes().catch(() => []),
            volumeSummaryAdapter.getSamples().catch(() => []),
        ]);
        const pvcByKey = new Map(pvcs.map(pvc => [`${pvc.metadata?.namespace}/${pvc.metadata?.name}`, pvc]));
        const pvByName = new Map(persistentVolumes.map(pv => [pv.metadata?.name, pv]));
        const result = new Map<string, VolumeFilesystemUsage>();
        const now = Date.now();
        for (const volume of volumes) {
            const pvcName = KubeObjectNameUtils.toPvcName(volume.sharedVolumeId || volume.id);
            const key = `${volume.projectId}/${pvcName}`;
            if (result.has(key)) continue;
            const pvc = pvcByKey.get(key);
            const pv = pvc?.spec?.volumeName ? pvByName.get(pvc.spec.volumeName) : undefined;
            if (!pv) {
                result.set(key, { pvcName, status: 'unavailable' });
                continue;
            }
            if (!supportsVolumeFilesystemMetrics(pv)) {
                result.set(key, { pvcName, status: 'unsupported' });
                continue;
            }
            const candidates = samples
                .filter(sample => sample.pvcRef?.namespace === volume.projectId && sample.pvcRef.name === pvcName)
                .filter(sample => {
                    const values = [sample.usedBytes, sample.availableBytes, sample.capacityBytes];
                    return values.every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0)
                        && !!sample.capacityBytes && Number.isFinite(Date.parse(sample.time ?? ''));
                })
                .sort((a, b) => Date.parse(b.time!) - Date.parse(a.time!));
            const sample = candidates[0];
            const age = sample ? now - Date.parse(sample.time!) : Infinity;
            if (!sample || age > 5 * 60 * 1000 || age < -60 * 1000) {
                result.set(key, { pvcName, status: sample ? 'stale' : 'unavailable' });
                continue;
            }
            result.set(key, {
                pvcName,
                status: 'available',
                usedBytes: sample.usedBytes,
                availableBytes: sample.availableBytes,
                capacityBytes: sample.capacityBytes,
                measuredAt: sample.time,
            });
        }
        return result;
    }

    async getAllAppVolumesUsage(): Promise<AppVolumeMonitoringUsageModel[]> {
        const appVolumes = await dataAccess.client.appVolume.findMany({
            include: { app: { include: { project: true } } },
            orderBy: { appId: 'asc' },
        });
        const usages = await this.getVolumeFilesystemUsage(
            appVolumes.map(volume => ({ ...volume, projectId: volume.app.projectId })),
        );
        return appVolumes.map(volume => {
            const pvcName = KubeObjectNameUtils.toPvcName(volume.sharedVolumeId || volume.id);
            return {
                ...usages.get(`${volume.app.projectId}/${pvcName}`)!,
                projectId: volume.app.projectId,
                projectName: volume.app.project.name,
                appName: volume.app.name,
                appId: volume.appId,
                mountPath: volume.containerMountPath,
                isBaseVolume: !volume.sharedVolumeId,
            };
        }).sort((a, b) => a.projectName.localeCompare(b.projectName) || a.appName.localeCompare(b.appName));
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

    async getPvcUsageFromApp(appId: string, projectId: string): Promise<VolumeFilesystemUsage[]> {
        const volumes = await dataAccess.client.appVolume.findMany({
            where: { appId },
            select: { id: true, sharedVolumeId: true },
        });
        const usages = await this.getVolumeFilesystemUsage(volumes.map(volume => ({ ...volume, projectId })));
        return Array.from(usages.values());
    }
}

const monitoringService = new MonitorService();
export default monitoringService;
