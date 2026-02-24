import { Constants } from "@/shared/utils/constants";
import { AppTemplateModel } from "../../model/app-template.model";
import { AppExtendedModel } from "@/shared/model/app-extended.model";
import { KubeObjectNameUtils } from "@/server/utils/kube-object-name.utils";

export const openwebuiAppTemplate: AppTemplateModel = {
    name: "Open WebUI",
    iconName: 'https://avatars.githubusercontent.com/u/158137808',
    templates: [{
        // Ollama Backend
        inputSettings: [
            {
                key: "containerImageSource",
                label: "Container Image",
                value: "ollama/ollama:latest",
                isEnvVar: false,
                randomGeneratedIfEmpty: false,
            },
        ],
        appModel: {
            name: "Ollama",
            appType: 'APP',
            sourceType: 'CONTAINER',
            containerImageSource: "",
            replicas: 1,
            ingressNetworkPolicy: Constants.DEFAULT_INGRESS_NETWORK_POLICY_APPS,
            egressNetworkPolicy: Constants.DEFAULT_EGRESS_NETWORK_POLICY_APPS,
            envVars: `OLLAMA_HOST=0.0.0.0
OLLAMA_ORIGINS=*
`,
            useNetworkPolicy: true,
            healthCheckPeriodSeconds: Constants.DEFAULT_HEALTH_CHECK_PERIOD_SECONDS,
            healthCheckTimeoutSeconds: Constants.DEFAULT_HEALTH_CHECK_TIMEOUT_SECONDS,
            healthCheckFailureThreshold: Constants.DEFAULT_HEALTH_CHECK_FAILURE_THRESHOLD,
        },
        appDomains: [],
        appVolumes: [{
            size: 10000,
            containerMountPath: '/root/.ollama',
            accessMode: 'ReadWriteOnce',
            storageClassName: 'longhorn',
            shareWithOtherApps: false,
        }],
        appFileMounts: [],
        appPorts: [{
            port: 11434,
        }]
    },
    // Open WebUI Frontend
    {
        inputSettings: [
            {
                key: "containerImageSource",
                label: "Container Image",
                value: "ghcr.io/open-webui/open-webui:main",
                isEnvVar: false,
                randomGeneratedIfEmpty: false,
            },
            {
                key: "WEBUI_SECRET_KEY",
                label: "Secret Key",
                value: "",
                isEnvVar: true,
                randomGeneratedIfEmpty: true,
            },
        ],
        appModel: {
            name: "Open WebUI",
            appType: 'APP',
            sourceType: 'CONTAINER',
            containerImageSource: "",
            replicas: 1,
            ingressNetworkPolicy: Constants.DEFAULT_INGRESS_NETWORK_POLICY_APPS,
            egressNetworkPolicy: Constants.DEFAULT_EGRESS_NETWORK_POLICY_APPS,
            envVars: ``,
            useNetworkPolicy: true,
            healthCheckPeriodSeconds: Constants.DEFAULT_HEALTH_CHECK_PERIOD_SECONDS,
            healthCheckTimeoutSeconds: Constants.DEFAULT_HEALTH_CHECK_TIMEOUT_SECONDS,
            healthCheckFailureThreshold: Constants.DEFAULT_HEALTH_CHECK_FAILURE_THRESHOLD,
        },
        appDomains: [],
        appVolumes: [{
            size: 2000,
            containerMountPath: '/app/backend/data',
            accessMode: 'ReadWriteOnce',
            storageClassName: 'longhorn',
            shareWithOtherApps: false,
        }],
        appFileMounts: [],
        appPorts: [{
            port: 8080,
        }]
    }]
}


export const postCreateOpenwebuiAppTemplate = async (createdApps: AppExtendedModel[]): Promise<AppExtendedModel[]> => {

    const createdOllamaApp = createdApps[0];
    const createdWebuiApp = createdApps[1];

    if (!createdOllamaApp || !createdWebuiApp) {
        throw new Error('Created templates for Ollama or Open WebUI not found.');
    }

    const ollamaAppInternalHostname = KubeObjectNameUtils.toServiceName(createdOllamaApp.id);
    const webUiInternalHostname = KubeObjectNameUtils.toServiceName(createdWebuiApp.id);

    createdWebuiApp.envVars += `OLLAMA_BASE_URLS=http://${ollamaAppInternalHostname}:11434`;

    return [createdOllamaApp, createdWebuiApp]
};