import { Constants } from "@/shared/utils/constants";
import { AppTemplateModel } from "../../model/app-template.model";
import { AppExtendedModel } from "@/shared/model/app-extended.model";
import { AppTemplateUtils } from "@/server/utils/app-template.utils";
import { EnvVarUtils } from "@/server/utils/env-var.utils";

export const n8nAppTemplate: AppTemplateModel = {
    name: "n8n",
    iconName: 'https://avatars.githubusercontent.com/u/45487711',
    templates: [{
        inputSettings: [
            {
                key: "containerImageSource",
                label: "Container Image",
                value: "n8nio/n8n:latest",
                isEnvVar: false,
                randomGeneratedIfEmpty: false,
            },
            {
                key: "TZ",
                label: "Timezone",
                value: "Europe/Zurich",
                isEnvVar: true,
                randomGeneratedIfEmpty: false,
            },
        ],
        appModel: {
            name: "n8n",
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
            securityContextFsGroup: 1000,
        },
        appDomains: [],
        appVolumes: [{
            size: 500,
            containerMountPath: '/home/node/.n8n',
            accessMode: 'ReadWriteOnce',
            storageClassName: 'longhorn',
            shareWithOtherApps: false,
        }],
        appFileMounts: [],
        appPorts: [{
            port: 5678,
        }]
    }],
};

export const postCreateN8NAppTemplate = async (createdApps: AppExtendedModel[]): Promise<AppExtendedModel[]> => {

    const createdN8nApp = createdApps[0];
    if (!createdN8nApp) {
        throw new Error('Created n8n app not found.');
    }

    const envVars = EnvVarUtils.parseEnvVariables(createdN8nApp);

    const encryptionKey = AppTemplateUtils.getRandomKey(64);
    createdN8nApp.envVars += `N8N_ENCRYPTION_KEY=${encryptionKey}\n`;

    const timeZone = envVars.find(x => x.name === 'TZ')?.value ?? 'Europe/Zurich';
    createdN8nApp.envVars += `GENERIC_TIMEZONE=${timeZone}\n`;

    return [createdN8nApp];
};

