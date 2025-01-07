import { AppTemplateModel } from "../../model/app-template.model";

export const mongodbAppTemplate: AppTemplateModel = {
    name: "MongoDB",
    iconName: 'mongodb.svg',
    templates: [{
        inputSettings: [
            {
                key: "containerImageSource",
                label: "Container Image",
                value: "mongo:7",
                isEnvVar: false,
                randomGeneratedIfEmpty: false,
            },
            {
                key: "MONGO_INITDB_DATABASE",
                label: "Database Name",
                value: "mongodb",
                isEnvVar: true,
                randomGeneratedIfEmpty: false,
            },
            {
                key: "MONGO_INITDB_ROOT_USERNAME",
                label: "Username",
                value: "mongodbuser",
                isEnvVar: true,
                randomGeneratedIfEmpty: false,
            },
            {
                key: "MONGO_INITDB_ROOT_PASSWORD",
                label: "Password",
                value: "",
                isEnvVar: true,
                randomGeneratedIfEmpty: true,
            },
        ],
        appModel: {
            name: "MongoDB",
            appType: 'MONGODB',
            sourceType: 'CONTAINER',
            containerImageSource: "",
            replicas: 1,
            envVars: ``,
        },
        appDomains: [],
        appVolumes: [{
            size: 500,
            containerMountPath: '/data/db',
            accessMode: 'ReadWriteOnce'
        }],
        appFileMounts: [],
        appPorts: [{
            port: 27017,
        }]
    }],
};