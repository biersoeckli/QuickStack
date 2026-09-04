import { Constants } from "@/shared/utils/constants";
import { AppTemplateModel } from "../../model/app-template.model";

export const uptimekumaAppTemplate: AppTemplateModel = {
    name: "Uptime Kuma",
    description: 'A self-hosted monitoring service for uptime checks, status pages, and notifications.',
    websiteUrl: 'https://github.com/louislam/uptime-kuma',
    iconName: 'https://raw.githubusercontent.com/louislam/uptime-kuma/master/public/icon.svg',
    templates: [{
        inputSettings: [
            {
                key: "containerImageSource",
                label: "Container Image",
                value: "louislam/uptime-kuma:latest",
                isEnvVar: false,
                randomGeneratedIfEmpty: false,
            },
        ],
        appModel: {
            name: "Uptime Kuma",
            appType: 'APP',
            sourceType: 'CONTAINER',
            containerImageSource: "",
            replicas: 1,
            ingressNetworkPolicy: Constants.DEFAULT_INGRESS_NETWORK_POLICY_APPS,
            egressNetworkPolicy: Constants.DEFAULT_EGRESS_NETWORK_POLICY_APPS,
            envVars: ``,
            useNetworkPolicy: true,
            networkPolicyMode: Constants.DEFAULT_NETWORK_POLICY_MODE_APPS,
            healthCheckPeriodSeconds: Constants.DEFAULT_HEALTH_CHECK_PERIOD_SECONDS,
            healthCheckTimeoutSeconds: Constants.DEFAULT_HEALTH_CHECK_TIMEOUT_SECONDS,
            healthCheckFailureThreshold: Constants.DEFAULT_HEALTH_CHECK_FAILURE_THRESHOLD,
        },
        appDomains: [],
        appVolumes: [{
            size: 200,
            containerMountPath: '/app/data',
            accessMode: 'ReadWriteOnce',
            storageClassName: 'longhorn',
            shareWithOtherApps: false,
        }],
        appFileMounts: [],
        appPorts: [{
            port: 3001,
        }]
    }],
};
