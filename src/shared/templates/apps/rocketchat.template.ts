import { Constants } from "@/shared/utils/constants";
import { AppTemplateModel } from "../../model/app-template.model";

export const rocketchatAppTemplate: AppTemplateModel = {
    name: "Rocket.Chat",
    description: 'A self-hosted communications platform for team chat, collaboration, and omnichannel messaging.',
    websiteUrl: 'https://github.com/RocketChat/Rocket.Chat',
    iconName: 'rocketchat.svg',
    templates: [{
        inputSettings: [
            {
                key: "containerImageSource",
                label: "Container Image",
                value: "rocket.chat:latest",
                isEnvVar: false,
                randomGeneratedIfEmpty: false,
            },
            {
                key: "ROOT_URL",
                label: "Root URL",
                value: "http://localhost:3000",
                isEnvVar: true,
                randomGeneratedIfEmpty: false,
            },
        ],
        appModel: {
            name: "Rocket.Chat",
            appType: 'APP',
            sourceType: 'CONTAINER',
            containerImageSource: "",
            replicas: 1,
            envVars: `PORT=3000
DEPLOY_METHOD=docker
`,
            useNetworkPolicy: true,
            healthCheckPeriodSeconds: Constants.DEFAULT_HEALTH_CHECK_PERIOD_SECONDS,
            healthCheckTimeoutSeconds: Constants.DEFAULT_HEALTH_CHECK_TIMEOUT_SECONDS,
            healthCheckFailureThreshold: Constants.DEFAULT_HEALTH_CHECK_FAILURE_THRESHOLD,
        },
        appDomains: [],
        appVolumes: [{
            size: 1000,
            containerMountPath: '/app/uploads',
            accessMode: 'ReadWriteOnce',
            storageClassName: 'longhorn',
            shareWithOtherApps: false,
        }],
        appFileMounts: [],
    }],
};
