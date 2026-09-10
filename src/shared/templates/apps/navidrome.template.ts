import { Constants } from "@/shared/utils/constants";
import { AppTemplateModel } from "../../model/app-template.model";

export const navidiomeAppTemplate: AppTemplateModel = {
    name: "Navidrome",
    description: 'A self-hosted music server for streaming and managing personal music collections.',
    websiteUrl: 'https://github.com/navidrome/navidrome',
    iconName: 'navidrome.png',
    templates: [{
        inputSettings: [
            {
                key: "containerImageSource",
                label: "Container Image",
                value: "deluan/navidrome:latest",
                isEnvVar: false,
                randomGeneratedIfEmpty: false,
            },
        ],
        appModel: {
            name: "Navidrome",
            appType: 'APP',
            sourceType: 'CONTAINER',
            containerImageSource: "",
            replicas: 1,
            envVars: `ND_SCANSCHEDULE=1h
ND_LOGLEVEL=info
ND_SESSIONTIMEOUT=24h
`,
            useNetworkPolicy: true,
            healthCheckPeriodSeconds: Constants.DEFAULT_HEALTH_CHECK_PERIOD_SECONDS,
            healthCheckTimeoutSeconds: Constants.DEFAULT_HEALTH_CHECK_TIMEOUT_SECONDS,
            healthCheckFailureThreshold: Constants.DEFAULT_HEALTH_CHECK_FAILURE_THRESHOLD,
        },
        appDomains: [],
        appVolumes: [{
            size: 100,
            containerMountPath: '/data',
            accessMode: 'ReadWriteOnce',
            storageClassName: 'longhorn',
            shareWithOtherApps: false,
        }, {
            size: 5000,
            containerMountPath: '/music',
            accessMode: 'ReadWriteOnce',
            storageClassName: 'longhorn',
            shareWithOtherApps: false,
        }],
        appFileMounts: [],
    }],
};
