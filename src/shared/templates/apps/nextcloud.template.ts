import { Constants } from "@/shared/utils/constants";
import { AppTemplateModel } from "../../model/app-template.model";

export const nextcloudAppTemplate: AppTemplateModel = {
    name: "Nextcloud",
    iconName: 'https://avatars.githubusercontent.com/u/19211038',
    templates: [{
        inputSettings: [
            {
                key: "containerImageSource",
                label: "Container Image",
                value: "nextcloud:stable",
                isEnvVar: false,
                randomGeneratedIfEmpty: false,
            },
            {
                key: "NEXTCLOUD_ADMIN_USER",
                label: "Admin Username",
                value: "admin",
                isEnvVar: true,
                randomGeneratedIfEmpty: false,
            },
            {
                key: "NEXTCLOUD_ADMIN_PASSWORD",
                label: "Admin Password",
                value: "",
                isEnvVar: true,
                randomGeneratedIfEmpty: true,
            },
        ],
        appModel: {
            name: "Nextcloud",
            appType: 'APP',
            sourceType: 'CONTAINER',
            containerImageSource: "",
            replicas: 1,
            ingressNetworkPolicy: Constants.DEFAULT_INGRESS_NETWORK_POLICY_APPS,
            egressNetworkPolicy: Constants.DEFAULT_EGRESS_NETWORK_POLICY_APPS,
            envVars: `SQLITE_DATABASE=nextcloud
`,
            useNetworkPolicy: true,
            healthCheckPeriodSeconds: Constants.DEFAULT_HEALTH_CHECK_PERIOD_SECONDS,
            healthCheckTimeoutSeconds: Constants.DEFAULT_HEALTH_CHECK_TIMEOUT_SECONDS,
            healthCheckFailureThreshold: Constants.DEFAULT_HEALTH_CHECK_FAILURE_THRESHOLD,
        },
        appDomains: [],
        appVolumes: [{
            size: 5000,
            containerMountPath: '/var/www/html',
            accessMode: 'ReadWriteOnce',
            storageClassName: 'longhorn',
            shareWithOtherApps: false,
        }],
        appFileMounts: [],
        appPorts: [{
            port: 80,
        }]
    }],
};
