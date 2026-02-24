import { Constants } from "@/shared/utils/constants";
import { AppTemplateModel } from "../../model/app-template.model";

export const ghostAppTemplate: AppTemplateModel = {
    name: "Ghost",
    iconName: 'https://cdn.simpleicons.org/ghost',
    templates: [{
        inputSettings: [
            {
                key: "containerImageSource",
                label: "Container Image",
                value: "ghost:latest",
                isEnvVar: false,
                randomGeneratedIfEmpty: false,
            },
            {
                key: "url",
                label: "Site URL",
                value: "http://localhost:2368",
                isEnvVar: true,
                randomGeneratedIfEmpty: false,
            },
        ],
        appModel: {
            name: "Ghost",
            appType: 'APP',
            sourceType: 'CONTAINER',
            containerImageSource: "",
            replicas: 1,
            ingressNetworkPolicy: Constants.DEFAULT_INGRESS_NETWORK_POLICY_APPS,
            egressNetworkPolicy: Constants.DEFAULT_EGRESS_NETWORK_POLICY_APPS,
            envVars: `database__client=sqlite3
database__connection__filename=/var/lib/ghost/content/data/ghost.db
`,
            useNetworkPolicy: true,
            healthCheckPeriodSeconds: Constants.DEFAULT_HEALTH_CHECK_PERIOD_SECONDS,
            healthCheckTimeoutSeconds: Constants.DEFAULT_HEALTH_CHECK_TIMEOUT_SECONDS,
            healthCheckFailureThreshold: Constants.DEFAULT_HEALTH_CHECK_FAILURE_THRESHOLD,
        },
        appDomains: [],
        appVolumes: [{
            size: 1000,
            containerMountPath: '/var/lib/ghost/content',
            accessMode: 'ReadWriteOnce',
            storageClassName: 'longhorn',
            shareWithOtherApps: false,
        }],
        appFileMounts: [],
        appPorts: [{
            port: 2368,
        }]
    }],
};
