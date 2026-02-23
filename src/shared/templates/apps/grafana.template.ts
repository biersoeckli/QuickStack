import { Constants } from "@/shared/utils/constants";
import { AppTemplateModel } from "../../model/app-template.model";

export const grafanaAppTemplate: AppTemplateModel = {
    name: "Grafana",
    iconName: 'https://raw.githubusercontent.com/grafana/grafana/main/public/img/grafana_icon.svg',
    templates: [{
        inputSettings: [
            {
                key: "containerImageSource",
                label: "Container Image",
                value: "grafana/grafana:latest",
                isEnvVar: false,
                randomGeneratedIfEmpty: false,
            },
            {
                key: "GF_SECURITY_ADMIN_USER",
                label: "Admin Username",
                value: "admin",
                isEnvVar: true,
                randomGeneratedIfEmpty: false,
            },
            {
                key: "GF_SECURITY_ADMIN_PASSWORD",
                label: "Admin Password",
                value: "",
                isEnvVar: true,
                randomGeneratedIfEmpty: true,
            },
        ],
        appModel: {
            name: "Grafana",
            appType: 'APP',
            sourceType: 'CONTAINER',
            containerImageSource: "",
            replicas: 1,
            ingressNetworkPolicy: Constants.DEFAULT_INGRESS_NETWORK_POLICY_APPS,
            egressNetworkPolicy: Constants.DEFAULT_EGRESS_NETWORK_POLICY_APPS,
            envVars: ``,
            useNetworkPolicy: true,
            healthCheckPeriodSeconds: 15,
            healthCheckTimeoutSeconds: 5,
            healthCheckFailureThreshold: Constants.DEFAULT_HEALTH_CHECK_FAILURE_THRESHOLD,
        },
        appDomains: [],
        appVolumes: [{
            size: 200,
            containerMountPath: '/var/lib/grafana',
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
