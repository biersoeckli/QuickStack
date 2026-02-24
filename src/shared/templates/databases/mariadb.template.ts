import { Constants } from "@/shared/utils/constants";
import { AppTemplateContentModel, AppTemplateModel } from "../../model/app-template.model";

export function getMariadbAppTemplate(config?: {
    appName?: string,
    dbName?: string,
    dbUsername?: string,
    dbPassword?: string,
    rootPassword?: string
}): AppTemplateContentModel {
    return {
        inputSettings: [
            {
                key: "containerImageSource",
                label: "Container Image",
                value: "mariadb:11",
                isEnvVar: false,
                randomGeneratedIfEmpty: false,
            },
            {
                key: "MYSQL_DATABASE",
                label: "Database Name",
                value: config?.dbName || "mariadb",
                isEnvVar: true,
                randomGeneratedIfEmpty: false,
            },
            {
                key: "MYSQL_USER",
                label: "Database User",
                value: config?.dbUsername || "mariadbuser",
                isEnvVar: true,
                randomGeneratedIfEmpty: false,
            },
            {
                key: "MYSQL_PASSWORD",
                label: "Database Passwort",
                value: config?.dbPassword || "",
                isEnvVar: true,
                randomGeneratedIfEmpty: true,
            },
            {
                key: "MYSQL_ROOT_PASSWORD",
                label: "Root Password",
                value: config?.rootPassword || "",
                isEnvVar: true,
                randomGeneratedIfEmpty: true,
            },
        ],
        appModel: {
            name: config?.appName || "MariaDB",
            appType: 'MARIADB',
            sourceType: 'CONTAINER',
            containerImageSource: "",
            ingressNetworkPolicy: Constants.DEFAULT_INGRESS_NETWORK_POLICY_DATABASES,
            egressNetworkPolicy: Constants.DEFAULT_EGRESS_NETWORK_POLICY_DATABASES,
            replicas: 1,
            envVars: ``,
            useNetworkPolicy: true,
            healthCheckPeriodSeconds: 15,
            healthCheckTimeoutSeconds: 5,
            healthCheckFailureThreshold: Constants.DEFAULT_HEALTH_CHECK_FAILURE_THRESHOLD,
        },
        appDomains: [],
        appVolumes: [{
            size: 400,
            containerMountPath: '/var/lib/mysql',
            accessMode: 'ReadWriteOnce',
            storageClassName: 'longhorn',
            shareWithOtherApps: false,
        }],
        appFileMounts: [],
        appPorts: [{
            port: 3306,
        }]
    };
}

export const mariadbAppTemplate: AppTemplateModel = {
    name: "MariaDB",
    iconName: 'mariadb.svg',
    templates: [
        getMariadbAppTemplate()
    ]
};