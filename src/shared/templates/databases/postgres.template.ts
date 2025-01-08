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
                randomGeneratedIfEmpty: true,
            },
        ],
        appModel: {
            name: "PostgreSQL",
            appType: 'POSTGRES',
            sourceType: 'CONTAINER',
            containerImageSource: "",
            replicas: 1,
            envVars: `PGDATA=/var/lib/qs-postgres/data
`,
        },
        appDomains: [],
        appVolumes: [{
            size: 300,
            containerMountPath: '/var/lib/qs-postgres',
            accessMode: 'ReadWriteOnce'
        }],
        appFileMounts: [],
        appPorts: [{
            port: 5432,
        }]
    }],
};