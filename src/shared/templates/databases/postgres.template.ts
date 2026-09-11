import { Constants } from "@/shared/utils/constants";
import { AppTemplateContentModel, AppTemplateModel } from "../../model/app-template.model";
import { AppExtendedModel } from "@/shared/model/app-extended.model";
import { NetworkPolicyTemplateUtils } from "../network-policy-template.utils";

export function getPostgresAppTemplate(config?: {
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
                value: "postgres:18-alpine",
                isEnvVar: false,
                randomGeneratedIfEmpty: false,
            },
            {
                key: "POSTGRES_DB",
                label: "Database Name",
                value: config?.dbName || "postgresdb",
                isEnvVar: true,
                randomGeneratedIfEmpty: false,
            },
            {
                key: "POSTGRES_USER",
                label: "Database User",
                value: config?.dbUsername || "postgresuser",
                isEnvVar: true,
                randomGeneratedIfEmpty: false,
            },
            {
                key: "POSTGRES_PASSWORD",
                label: "Database Password",
                value: config?.dbPassword || "",
                isEnvVar: true,
                randomGeneratedIfEmpty: true,
            },
        ],
        appModel: {
            name: config?.appName || "PostgreSQL",
            appType: 'POSTGRES',
            sourceType: 'CONTAINER',
            containerImageSource: "",
            replicas: 1,
            envVars: `PGDATA=/var/lib/qs-postgres/data
`,
            useNetworkPolicy: true,
            healthCheckPeriodSeconds: Constants.DEFAULT_HEALTH_CHECK_PERIOD_SECONDS,
            healthCheckTimeoutSeconds: 5,
            healthCheckFailureThreshold: Constants.DEFAULT_HEALTH_CHECK_FAILURE_THRESHOLD,
        },
        appDomains: [],
        appVolumes: [{
            size: 300,
            containerMountPath: '/var/lib/qs-postgres',
            accessMode: 'ReadWriteOnce',
            storageClassName: 'longhorn',
            shareWithOtherApps: false,
        }],
        appFileMounts: [],
    };
}

export const postgreAppTemplate: AppTemplateModel = {
    name: "PostgreSQL",
    description: 'A powerful open-source relational database with advanced SQL and extensibility features.',
    websiteUrl: 'https://github.com/postgres/postgres',
    iconName: 'postgres.svg',
    templates: [
        getPostgresAppTemplate()
    ]
};

export const postCreatePostgresAppTemplate = async (createdApps: AppExtendedModel[]): Promise<AppExtendedModel[]> => {
    const postgresApp = createdApps[0];

    NetworkPolicyTemplateUtils.denyInternetAccess(postgresApp);

    return [postgresApp];
};
