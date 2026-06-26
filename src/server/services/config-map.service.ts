import { AppExtendedModel } from "@/shared/model/app-extended.model";
import { AgentWithRelationsModel } from "@/shared/model/agent-extended.model";
import k3s from "../adapter/kubernetes-api.adapter";
import { KubeObjectNameUtils } from "../utils/kube-object-name.utils";
import { Constants } from "../../shared/utils/constants";
import { PathUtils } from "../utils/path.utils";
import * as k8s from '@kubernetes/client-node';
import { dlog } from "./deployment-logs.service";

class ConfigMapService {

    private async getConfigMapsForApp(projectId: string, appId: string) {
        const configMaps = await k3s.core.listNamespacedConfigMap(projectId);

        return configMaps.body.items.filter(cm => {
            return cm.metadata?.annotations?.[Constants.QS_ANNOTATION_APP_ID] === appId;
        });
    }

    private async getConfigMapsForAgentFileMounts(projectId: string, agentId: string) {
        const configMaps = await k3s.core.listNamespacedConfigMap(projectId);

        return configMaps.body.items.filter(cm => {
            return cm.metadata?.annotations?.[Constants.QS_ANNOTATION_AGENT_ID] === agentId
                && !!cm.metadata?.annotations?.['qs-agent-file-mount-id'];
        });
    }

    async createOrUpdateConfigMapForApp(app: AppExtendedModel) {

        if (app.appFileMounts.length === 0) {
            return { fileVolumeMounts: [], fileVolumes: [] };
        }

        const fileVolumeMounts: k8s.V1VolumeMount[] = [];
        const fileVolumes: k8s.V1Volume[] = [];

        for (const fileMount of app.appFileMounts) {
            const currentConfigMapName = KubeObjectNameUtils.getConfigMapName(fileMount.id);

            let { folderPath, filePath } = PathUtils.splitPath(fileMount.containerMountPath);
            if (!folderPath) {
                folderPath = '/';
            }

            const configMapManifest = {
                apiVersion: 'v1',
                kind: 'ConfigMap',
                metadata: {
                    name: currentConfigMapName,
                    namespace: app.projectId,
                    annotations: {
                        [Constants.QS_ANNOTATION_APP_ID]: app.id,
                        [Constants.QS_ANNOTATION_PROJECT_ID]: app.projectId,
                        'qs-app-file-mount-id': fileMount.id,
                    }
                },
                data: {
                    [filePath]: fileMount.content
                },
            };

            await this.createOrUpdateConfigMap(app.projectId, configMapManifest);
            const containerMountPath = fileMount.containerMountPath;

            const { fileVolumeMount, fileVolume } = this.createFileVolumeConfig(currentConfigMapName, containerMountPath, filePath);

            fileVolumeMounts.push(fileVolumeMount);
            fileVolumes.push(fileVolume);
        }

        return { fileVolumeMounts, fileVolumes };
    }

    async createOrUpdateConfigMapForAgent(agent: AgentWithRelationsModel) {

        if (agent.agentFileMounts.length === 0) {
            return { fileVolumeMounts: [], fileVolumes: [] };
        }

        const fileVolumeMounts: k8s.V1VolumeMount[] = [];
        const fileVolumes: k8s.V1Volume[] = [];

        for (const fileMount of agent.agentFileMounts) {
            const currentConfigMapName = KubeObjectNameUtils.getConfigMapName(fileMount.id);

            let { folderPath, filePath } = PathUtils.splitPath(fileMount.containerMountPath);
            if (!folderPath) {
                folderPath = '/';
            }

            const configMapManifest = {
                apiVersion: 'v1',
                kind: 'ConfigMap',
                metadata: {
                    name: currentConfigMapName,
                    namespace: agent.projectId,
                    annotations: {
                        [Constants.QS_ANNOTATION_AGENT_ID]: agent.id,
                        [Constants.QS_ANNOTATION_PROJECT_ID]: agent.projectId,
                        'qs-agent-file-mount-id': fileMount.id,
                    }
                },
                data: {
                    [filePath]: fileMount.content
                },
            };

            await this.createOrUpdateConfigMap(agent.projectId, configMapManifest);
            const containerMountPath = fileMount.containerMountPath;

            const { fileVolumeMount, fileVolume } = this.createFileVolumeConfig(currentConfigMapName, containerMountPath, filePath);

            fileVolumeMounts.push(fileVolumeMount);
            fileVolumes.push(fileVolume);
        }

        return { fileVolumeMounts, fileVolumes };
    }

    createFileVolumeConfig(currentConfigMapName: string, containerMountPath: string, fileName: string, readOnly = true) {
        const fileVolumeMount = {
            name: currentConfigMapName,
            mountPath: containerMountPath,
            subPath: fileName,
            readOnly
        } as k8s.V1VolumeMount;

        const fileVolume = {
            name: currentConfigMapName,
            configMap: {
                name: currentConfigMapName,
            }
        } as k8s.V1Volume;
        return { fileVolumeMount, fileVolume };
    }

    async getExistingConfigMap(namespace: string, configMapName: string) {
        const configMaps = await k3s.core.listNamespacedConfigMap(namespace);
        return configMaps.body.items.find(cm => cm.metadata?.name === configMapName);
    }

    async createOrUpdateConfigMap(namespace: string, configMapManifest: k8s.V1ConfigMap) {
        const currentConfigMapName = configMapManifest.metadata!.name!;
        const existingConfigMaps = await this.getExistingConfigMap(namespace, currentConfigMapName);
        if (!!existingConfigMaps) {
            await k3s.core.replaceNamespacedConfigMap(currentConfigMapName, namespace, configMapManifest);
        } else {
            await k3s.core.createNamespacedConfigMap(namespace, configMapManifest);
        }
    }

    async deleteUnusedConfigMaps(app: AppExtendedModel) {
        const existingConfigMaps = await this.getConfigMapsForApp(app.projectId, app.id);
        for (const cm of existingConfigMaps) {
            if (!app.appFileMounts.some(fm => KubeObjectNameUtils.getConfigMapName(fm.id) === cm.metadata?.name)) {
                await k3s.core.deleteNamespacedConfigMap(cm.metadata!.name!, app.projectId);
            }
        }
    }

    async deleteUnusedConfigMapsForAgent(agent: AgentWithRelationsModel) {
        const existingConfigMaps = await this.getConfigMapsForAgentFileMounts(agent.projectId, agent.id);
        for (const cm of existingConfigMaps) {
            if (!agent.agentFileMounts.some(fm => KubeObjectNameUtils.getConfigMapName(fm.id) === cm.metadata?.name)) {
                await k3s.core.deleteNamespacedConfigMap(cm.metadata!.name!, agent.projectId);
            }
        }
    }

    async deleteConfigMapIfExists(namespace: string, configMapName: string) {
        const existingConfigMap = await this.getExistingConfigMap(namespace, configMapName);
        if (!!existingConfigMap) {
            await k3s.core.deleteNamespacedConfigMap(configMapName, namespace);
        }
    }
}

const configMapService = new ConfigMapService();
export default configMapService;
