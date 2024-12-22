import { AppTemplateModel } from "../../model/app-template.model";

export const postgreAppTemplate: AppTemplateModel = {
    name: "PostgreSQL",
    iconName: 'postgres.svg',
    templates: [{
        inputSettings: [
            {
                key: "containerImageSource",
                label: "Container Image",
                value: "postgres:17",
                isEnvVar: false,
                randomGeneratedIfEmpty: false,
            },
            {
                key: "POSTGRES_DB",
                label: "Database Name",
                value: "postgresdb",
                isEnvVar: true,
                randomGeneratedIfEmpty: false,
            },
            {
                key: "POSTGRES_USER",
                label: "Database User",
                value: "postgresuser",
                isEnvVar: true,
                randomGeneratedIfEmpty: false,
            },
            {
                key: "POSTGRES_PASSWORD",
                label: "Database Password",
                value: "",
                isEnvVar: true,
                randomGeneratedIfEmpty: false,
            },
        ],
        appModel: {
            name: "PostgreSQL",
            appType: 'POSTGRES',
            sourceType: 'CONTAINER',
            containerImageSource: "",
            replicas: 1,
            envVars: ``,
        },
        appDomains: [],
        appVolumes: [{
            size: 500,
            containerMountPath: '/var/lib/postgresql/data',
            accessMode: 'ReadWriteOnce'
        }],
        appPorts: [{
            port: 5432,
        }]
    }],
};