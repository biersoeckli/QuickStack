import { Constants } from "@/shared/utils/constants";
import { AppTemplateModel } from "../../model/app-template.model";

export const homeassistantAppTemplate: AppTemplateModel = {
    name: "Home Assistant",
    description: 'An open-source home automation platform for integrating and controlling smart devices.',
    websiteUrl: 'https://github.com/home-assistant/core',
    iconName: 'homeassistant.svg',
    templates: [{
        inputSettings: [
            {
                key: "containerImageSource",
                label: "Container Image",
                value: "homeassistant/home-assistant:stable",
                isEnvVar: false,
                randomGeneratedIfEmpty: false,
            },
        ],
        appModel: {
            name: "Home Assistant",
            appType: 'APP',
            sourceType: 'CONTAINER',
            containerImageSource: "",
            replicas: 1,
            envVars: `TZ=Europe/Zurich
`,
            useNetworkPolicy: true,
            healthCheckPeriodSeconds: Constants.DEFAULT_HEALTH_CHECK_PERIOD_SECONDS,
            healthCheckTimeoutSeconds: Constants.DEFAULT_HEALTH_CHECK_TIMEOUT_SECONDS,
            healthCheckFailureThreshold: Constants.DEFAULT_HEALTH_CHECK_FAILURE_THRESHOLD,
        },
        appDomains: [],
        appVolumes: [{
            size: 1000,
            containerMountPath: '/config',
            accessMode: 'ReadWriteOnce',
            storageClassName: 'longhorn',
            shareWithOtherApps: false,
        }],
        appFileMounts: [],
    }],
};
