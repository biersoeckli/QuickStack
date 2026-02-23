import { Constants } from "@/shared/utils/constants";
import { AppTemplateModel } from "../../model/app-template.model";

export const minioAppTemplate: AppTemplateModel = {
    name: "MinIO",
    iconName: 'https://raw.githubusercontent.com/minio/minio/master/.github/logo.svg',
    templates: [{
        inputSettings: [
            {
                key: "containerImageSource",
                label: "Container Image",
                value: "minio/minio:latest",
                isEnvVar: false,
                randomGeneratedIfEmpty: false,
            },
            {
                key: "MINIO_ROOT_USER",
                label: "Root Username",
                value: "minioadmin",
                isEnvVar: true,
                randomGeneratedIfEmpty: false,
            },
            {
                key: "MINIO_ROOT_PASSWORD",
                label: "Root Password",
                value: "",
                isEnvVar: true,
                randomGeneratedIfEmpty: true,
            },
        ],
        appModel: {
            name: "MinIO",
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
            containerCommand: 'minio',
            containerArgs: '["server", "/data", "--console-address", ":9001"]',
        },
        appDomains: [],
        appVolumes: [{
            size: 5000,
            containerMountPath: '/data',
            accessMode: 'ReadWriteOnce',
            storageClassName: 'longhorn',
            shareWithOtherApps: false,
        }],
        appFileMounts: [],
        appPorts: [{
            port: 9000,
        }, {
            port: 9001,
        }]
    }],
};
