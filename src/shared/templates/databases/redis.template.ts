import { Constants } from "@/shared/utils/constants";
import { AppTemplateContentModel, AppTemplateModel } from "../../model/app-template.model";
import { AppExtendedModel } from "@/shared/model/app-extended.model";
import { AppTemplateUtils } from "@/server/utils/app-template.utils";

export function getRedisAppTemplate(config?: {
    appName?: string
}): AppTemplateContentModel {
    return {
        inputSettings: [
            {
                key: "containerImageSource",
                label: "Container Image",
                value: "redis:8-alpine",
                isEnvVar: false,
                randomGeneratedIfEmpty: false,
            }
        ],
        appModel: {
            name: config?.appName || "Redis",
            appType: 'REDIS',
            sourceType: 'CONTAINER',
            containerImageSource: "",
            replicas: 1,
            ingressNetworkPolicy: Constants.DEFAULT_INGRESS_NETWORK_POLICY_DATABASES,
            egressNetworkPolicy: Constants.DEFAULT_EGRESS_NETWORK_POLICY_DATABASES,
            envVars: ``,
            useNetworkPolicy: true,
            healthCheckPeriodSeconds: Constants.DEFAULT_HEALTH_CHECK_PERIOD_SECONDS,
            healthCheckTimeoutSeconds: 5,
            healthCheckFailureThreshold: Constants.DEFAULT_HEALTH_CHECK_FAILURE_THRESHOLD,
            containerCommand: 'redis-server',
        },
        appDomains: [],
        appVolumes: [{
            size: 200,
            containerMountPath: '/data',
            accessMode: 'ReadWriteOnce',
            storageClassName: 'longhorn',
            shareWithOtherApps: false,
        }],
        appFileMounts: [],
        appPorts: [{
            port: 6379,
        }]
    };
}

export const redisAppTemplate: AppTemplateModel = {
    name: "Redis",
    iconName: 'https://cdn.simpleicons.org/redis',
    templates: [
        getRedisAppTemplate()
    ],
};

export const postCreateRedisAppTemplate = async (createdApps: AppExtendedModel[]): Promise<AppExtendedModel[]> => {

    const redisApp = createdApps[0];

    const createdPassword = AppTemplateUtils.generateStrongPasswort(25);
    redisApp.containerArgs = `["--requirepass", "${createdPassword}"]`;

    return [redisApp];
};
