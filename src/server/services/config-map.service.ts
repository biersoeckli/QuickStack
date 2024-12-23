import { AppExtendedModel } from "@/shared/model/app-extended.model";
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

    async createOrUpdateConfigMapForApp(app: AppExtendedModel) {

        const existingConfigMaps = await this.getConfigMapsForApp(app.projectId, app.id);

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

            if (existingConfigMaps.some(cm => cm.metadata!.name === currentConfigMapName)) {
                await k3s.core.replaceNamespacedConfigMap(currentConfigMapName, app.projectId, configMapManifest);
            } else {
                await k3s.core.createNamespacedConfigMap(app.projectId, configMapManifest);
            }

            fileVolumeMounts.push({
                name: currentConfigMapName,
                mountPath: fileMount.containerMountPath,
                subPath: filePath,
                readOnly: true
            });

            fileVolumes.push({
                name: currentConfigMapName,
                configMap: {
                    name: currentConfigMapName,
                }
            });
        }

        return { fileVolumeMounts, fileVolumes };
    }


    async deleteUnusedConfigMaps(app: AppExtendedModel) {
        const existingConfigMaps = await this.getConfigMapsForApp(app.projectId, app.id);
        for (const cm of existingConfigMaps) {
            if (!app.appFileMounts.some(fm => KubeObjectNameUtils.getConfigMapName(fm.id) === cm.metadata?.name)) {
                await k3s.core.deleteNamespacedConfigMap(cm.metadata!.name!, app.projectId);
            }
        }
    }
}

const configMapService = new ConfigMapService();
export default configMapService;
