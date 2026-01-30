import { Constants } from "@/shared/utils/constants";
import { AppTemplateModel } from "../../model/app-template.model";

export const mysqlAppTemplate: AppTemplateModel = {
    name: "MySQL",
    iconName: 'mysql.svg',
    templates: [{
        inputSettings: [
            {
                key: "containerImageSource",
                label: "Container Image",
                value: "mysql:9",
                isEnvVar: false,
                randomGeneratedIfEmpty: false,
            },
            {
                key: "MYSQL_DATABASE",
                label: "Database Name",
                value: "mysqldb",
                isEnvVar: true,
                randomGeneratedIfEmpty: false,
            },
            {
                key: "MYSQL_USER",
                label: "Database User",
                value: "mysqluser",
                isEnvVar: true,
                randomGeneratedIfEmpty: false,
            },
            {
                key: "MYSQL_PASSWORD",
                label: "Database Password",
                value: "",
                isEnvVar: true,
                randomGeneratedIfEmpty: true,
            },
            {
                key: "MYSQL_ROOT_PASSWORD",
                label: "Root Password",
                value: "",
                isEnvVar: true,
                randomGeneratedIfEmpty: true,
            },
        ],
        appModel: {
            name: "MySQL",
            appType: 'MYSQL',
            sourceType: 'CONTAINER',
            containerImageSource: "",
            replicas: 1,
            envVars: ``,
            ingressNetworkPolicy: Constants.DEFAULT_INGRESS_NETWORK_POLICY_DATABASES,
            egressNetworkPolicy: Constants.DEFAULT_EGRESS_NETWORK_POLICY_DATABASES,
            useNetworkPolicy: true,
            healthCheckPeriodSeconds: 15,
            healthCheckTimeoutSeconds: 5,
            healthCheckFailureThreshold: 3,
        },
        appDomains: [],
        appVolumes: [{
            size: 500,
            containerMountPath: '/var/lib/mysql',
            accessMode: 'ReadWriteOnce',
            storageClassName: 'longhorn',
        }],
        appFileMounts: [],
        appPorts: [{
            port: 3306,
        }]
    }]
}