import { AppTemplateModel } from "../model/app-template.model";

export const mariadbAppTemplate: AppTemplateModel = {
    name: "MariaDB",
    templates: [{
        inputSettings: [
            {
                key: "MYSQL_ROOT_PASSWORD",
                label: "Root Password",
                value: "mariadb",
                isEnvVar: true,
            },
            {
                key: "MYSQL_USER",
                label: "User",
                value: "mariadb",
                isEnvVar: true,
            },
            {
                key: "MYSQL_PASSWORD",
                label: "Password",
                value: "mariadb",
                isEnvVar: true,
            },
            {
                key: "MYSQL_DATABASE",
                label: "Database",
                value: "defaultdb",
                isEnvVar: true,
            },
        ],
        appModel: {
            name: "MariaDb",
            sourceType: 'CONTAINER',
            containerImageSource: "mariadb:latest",
            replicas: 1,
            envVars: ``,
        },
        appDomains: [],
        appVolumes: [{
            size: 500,
            containerMountPath: '/var/lib/mysql',
            accessMode: 'ReadWriteOnce'
        }],
        appPorts: [{
            port: 3306,
        }]
    }]
}
