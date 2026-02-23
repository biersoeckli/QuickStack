import { Constants } from "@/shared/utils/constants";
import { AppTemplateModel } from "../../model/app-template.model";
import { AppExtendedModel } from "@/shared/model/app-extended.model";
import { AppTemplateUtils } from "@/server/utils/app-template.utils";

export const duplicatiAppTemplate: AppTemplateModel = {
    name: "Duplicati",
    iconName: 'https://avatars.githubusercontent.com/u/2245683?s=200&v=4',
    templates: [{
        inputSettings: [
            {
                key: "containerImageSource",
                label: "Container Image",
                value: "duplicati/duplicati:latest",
                isEnvVar: false,
                randomGeneratedIfEmpty: false,
            }
        ],
        appModel: {
            name: "Duplicati",
            appType: 'APP',
            sourceType: 'CONTAINER',
            containerImageSource: "",
            replicas: 1,
            ingressNetworkPolicy: Constants.DEFAULT_INGRESS_NETWORK_POLICY_APPS,
            egressNetworkPolicy: Constants.DEFAULT_EGRESS_NETWORK_POLICY_APPS,
            envVars: ``,
            useNetworkPolicy: true,
            healthCheckPeriodSeconds: Constants.DEFAULT_HEALTH_CHECK_PERIOD_SECONDS,
            healthCheckTimeoutSeconds: Constants.DEFAULT_HEALTH_CHECK_TIMEOUT_SECONDS,
            healthCheckFailureThreshold: Constants.DEFAULT_HEALTH_CHECK_FAILURE_THRESHOLD,
        },
        appDomains: [],
        appVolumes: [{
            size: 100,
            containerMountPath: '/config',
            accessMode: 'ReadWriteOnce',
            storageClassName: 'longhorn',
            shareWithOtherApps: false,
        }, {
            size: 800,
            containerMountPath: '/backups',
            accessMode: 'ReadWriteOnce',
            storageClassName: 'longhorn',
            shareWithOtherApps: false,
        }],
        appFileMounts: [],
        appPorts: [{
            port: 8200,
        }]
    }],
};


export const postCreateDuplicatiAppTemplate = async (createdApps: AppExtendedModel[]): Promise<AppExtendedModel[]> => {
    const duplicatiApp = createdApps[0];

    // strong password generator for system user
    const encryptionKey = AppTemplateUtils.getRandomKey(32);
    duplicatiApp.envVars += `TZ=Europe/London
SETTINGS_ENCRYPTION_KEY=${encryptionKey}
DUPLICATI__WEBSERVICE_ALLOWED_HOSTNAMES=*
`;
    return [duplicatiApp];
};
