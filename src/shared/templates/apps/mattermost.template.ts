import { Constants } from "@/shared/utils/constants";
import { AppTemplateModel } from "../../model/app-template.model";

export const mattermostAppTemplate: AppTemplateModel = {
    name: "Mattermost",
    description: 'A self-hosted team messaging platform for secure collaboration and workflow integrations.',
    websiteUrl: 'https://github.com/mattermost/mattermost',
    iconName: 'mattermost.png',
    templates: [{
        inputSettings: [
            {
                key: "containerImageSource",
                label: "Container Image",
                value: "mattermost/mattermost-team-edition:latest",
                isEnvVar: false,
                randomGeneratedIfEmpty: false,
            },
        ],
        appModel: {
            name: "Mattermost",
            appType: 'APP',
            sourceType: 'CONTAINER',
            containerImageSource: "",
            replicas: 1,
            envVars: `TZ=Europe/Zurich
MM_SQLSETTINGS_DRIVERNAME=postgres
`,
            useNetworkPolicy: true,
            healthCheckPeriodSeconds: Constants.DEFAULT_HEALTH_CHECK_PERIOD_SECONDS,
            healthCheckTimeoutSeconds: Constants.DEFAULT_HEALTH_CHECK_TIMEOUT_SECONDS,
            healthCheckFailureThreshold: Constants.DEFAULT_HEALTH_CHECK_FAILURE_THRESHOLD,
        },
        appDomains: [],
        appVolumes: [{
            size: 2000,
            containerMountPath: '/mattermost/data',
            accessMode: 'ReadWriteOnce',
            storageClassName: 'longhorn',
            shareWithOtherApps: false,
        }, {
            size: 200,
            containerMountPath: '/mattermost/config',
            accessMode: 'ReadWriteOnce',
            storageClassName: 'longhorn',
            shareWithOtherApps: false,
        }],
        appFileMounts: [],
    }],
};
