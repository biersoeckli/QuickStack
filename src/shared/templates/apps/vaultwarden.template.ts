import { Constants } from "@/shared/utils/constants";
import { AppTemplateModel } from "../../model/app-template.model";

export const vaultwardenAppTemplate: AppTemplateModel = {
    name: "Vaultwarden",
    description: 'A lightweight, self-hosted Bitwarden-compatible password manager server.',
    websiteUrl: 'https://github.com/dani-garcia/vaultwarden',
    iconName: 'vaultwarden.svg',
    templates: [{
        inputSettings: [
            {
                key: "containerImageSource",
                label: "Container Image",
                value: "vaultwarden/server:latest",
                isEnvVar: false,
                randomGeneratedIfEmpty: false,
            },
            {
                key: "ADMIN_TOKEN",
                label: "Admin Token",
                value: "",
                isEnvVar: true,
                randomGeneratedIfEmpty: true,
            },
        ],
        appModel: {
            name: "Vaultwarden",
            appType: 'APP',
            sourceType: 'CONTAINER',
            containerImageSource: "",
            replicas: 1,
            envVars: `SIGNUPS_ALLOWED=true
WEBSOCKET_ENABLED=true
`,
            useNetworkPolicy: true,
            healthCheckPeriodSeconds: Constants.DEFAULT_HEALTH_CHECK_PERIOD_SECONDS,
            healthCheckTimeoutSeconds: Constants.DEFAULT_HEALTH_CHECK_TIMEOUT_SECONDS,
            healthCheckFailureThreshold: Constants.DEFAULT_HEALTH_CHECK_FAILURE_THRESHOLD,
        },
        appDomains: [],
        appVolumes: [{
            size: 200,
            containerMountPath: '/data',
            accessMode: 'ReadWriteOnce',
            storageClassName: 'longhorn',
            shareWithOtherApps: false,
        }],
        appFileMounts: [],
    }],
};
