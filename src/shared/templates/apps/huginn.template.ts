import { Constants } from "@/shared/utils/constants";
import { AppTemplateModel } from "../../model/app-template.model";

export const huginnAppTemplate: AppTemplateModel = {
    name: "Huginn",
    description: 'A self-hosted automation system for monitoring events and running workflows from web data.',
    websiteUrl: 'https://github.com/huginn/huginn',
    iconName: 'https://raw.githubusercontent.com/huginn/huginn/master/public/favicon.ico',
    templates: [{
        inputSettings: [
            {
                key: "containerImageSource",
                label: "Container Image",
                value: "ghcr.io/huginn/huginn:latest",
                isEnvVar: false,
                randomGeneratedIfEmpty: false,
            },
            {
                key: "INVITATION_CODE",
                label: "Invitation Code",
                value: "",
                isEnvVar: true,
                randomGeneratedIfEmpty: true,
            },
            {
                key: "APP_SECRET_TOKEN",
                label: "Secret Token",
                value: "",
                isEnvVar: true,
                randomGeneratedIfEmpty: true,
            },
        ],
        appModel: {
            name: "Huginn",
            appType: 'APP',
            sourceType: 'CONTAINER',
            containerImageSource: "",
            replicas: 1,
            envVars: `TIMEZONE=Europe/Zurich
`,
            useNetworkPolicy: true,
            healthCheckPeriodSeconds: Constants.DEFAULT_HEALTH_CHECK_PERIOD_SECONDS,
            healthCheckTimeoutSeconds: Constants.DEFAULT_HEALTH_CHECK_TIMEOUT_SECONDS,
            healthCheckFailureThreshold: Constants.DEFAULT_HEALTH_CHECK_FAILURE_THRESHOLD,
        },
        appDomains: [],
        appVolumes: [{
            size: 500,
            containerMountPath: '/var/lib/mysql',
            accessMode: 'ReadWriteOnce',
            storageClassName: 'longhorn',
            shareWithOtherApps: false,
        }],
        appFileMounts: [],
    }],
};
