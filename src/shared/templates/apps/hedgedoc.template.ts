import { Constants } from "@/shared/utils/constants";
import { AppTemplateModel } from "../../model/app-template.model";

export const hedgedocAppTemplate: AppTemplateModel = {
    name: "HedgeDoc",
    iconName: 'https://raw.githubusercontent.com/hedgedoc/hedgedoc/master/public/icons/android-chrome-512x512.png',
    templates: [{
        inputSettings: [
            {
                key: "containerImageSource",
                label: "Container Image",
                value: "quay.io/hedgedoc/hedgedoc:latest",
                isEnvVar: false,
                randomGeneratedIfEmpty: false,
            },
            {
                key: "CMD_SESSION_SECRET",
                label: "Session Secret",
                value: "",
                isEnvVar: true,
                randomGeneratedIfEmpty: true,
            },
        ],
        appModel: {
            name: "HedgeDoc",
            appType: 'APP',
            sourceType: 'CONTAINER',
            containerImageSource: "",
            replicas: 1,
            ingressNetworkPolicy: Constants.DEFAULT_INGRESS_NETWORK_POLICY_APPS,
            egressNetworkPolicy: Constants.DEFAULT_EGRESS_NETWORK_POLICY_APPS,
            envVars: `CMD_DB_URL=sqlite:///hedgedoc/database.sqlite
CMD_ALLOW_ANONYMOUS=false
CMD_ALLOW_ANONYMOUS_EDITS=true
`,
            useNetworkPolicy: true,
            healthCheckPeriodSeconds: Constants.DEFAULT_HEALTH_CHECK_PERIOD_SECONDS,
            healthCheckTimeoutSeconds: Constants.DEFAULT_HEALTH_CHECK_TIMEOUT_SECONDS,
            healthCheckFailureThreshold: Constants.DEFAULT_HEALTH_CHECK_FAILURE_THRESHOLD,
        },
        appDomains: [],
        appVolumes: [{
            size: 500,
            containerMountPath: '/hedgedoc',
            accessMode: 'ReadWriteOnce',
            storageClassName: 'longhorn',
            shareWithOtherApps: false,
        }],
        appFileMounts: [],
        appPorts: [{
            port: 3000,
        }]
    }],
};
