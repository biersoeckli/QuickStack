import { Constants } from "@/shared/utils/constants";
import { AppTemplateContentModel, AppTemplateModel } from "../../model/app-template.model";

export function getMongodbAppTemplate(config?: {
    appName?: string,
    dbName?: string,
    dbUsername?: string,
    dbPassword?: string
}): AppTemplateContentModel {
    return {
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
                value: config?.dbName || "mongodb",
                isEnvVar: true,
                randomGeneratedIfEmpty: false,
            },
            {
                key: "MONGO_INITDB_ROOT_USERNAME",
                label: "Username",
                value: config?.dbUsername || "mongodbuser",
                isEnvVar: true,
                randomGeneratedIfEmpty: false,
            },
            {
                key: "MONGO_INITDB_ROOT_PASSWORD",
                label: "Password",
                value: config?.dbPassword || "",
                isEnvVar: true,
                randomGeneratedIfEmpty: true,
            },
        ],
        appModel: {
            name: config?.appName || "MongoDB",
            appType: 'MONGODB',
            sourceType: 'CONTAINER',
            containerImageSource: "",
            healthCheckFailureThreshold: Constants.DEFAULT_HEALTH_CHECK_FAILURE_THRESHOLD,
            replicas: 1,
            envVars: ``,
            useNetworkPolicy: true,
            healthCheckPeriodSeconds: 15,
            healthCheckTimeoutSeconds: 5,
        },
        appDomains: [],
        appVolumes: [{
            size: 500,
            containerMountPath: '/data/db',
            accessMode: 'ReadWriteOnce',
            storageClassName: 'longhorn',
            shareWithOtherApps: false,
        }],
        appFileMounts: [],
    };
}

export const mongodbAppTemplate: AppTemplateModel = {
    name: "MongoDB",
    description: 'A document-oriented NoSQL database for flexible application data and queries.',
    websiteUrl: 'https://github.com/mongodb/mongo',
    iconName: 'mongodb.svg',
    templates: [
        getMongodbAppTemplate()
    ],
};
