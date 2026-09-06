import { Constants } from "@/shared/utils/constants";
import { AppTemplateModel } from "../../model/app-template.model";

export const forgejopAppTemplate: AppTemplateModel = {
    name: "Forgejo",
    description: 'A lightweight, self-hosted Git forge for repositories, issues, pull requests, and CI integrations.',
    websiteUrl: 'https://codeberg.org/forgejo/forgejo',
    iconName: 'https://codeberg.org/forgejo/forgejo/raw/branch/forgejo/assets/logo.svg',
    templates: [{
        inputSettings: [
            {
                key: "containerImageSource",
                label: "Container Image",
                value: "codeberg.org/forgejo/forgejo:latest",
                isEnvVar: false,
                randomGeneratedIfEmpty: false,
            },
        ],
        appModel: {
            name: "Forgejo",
            appType: 'APP',
            sourceType: 'CONTAINER',
            containerImageSource: "",
            replicas: 1,
            ingressNetworkPolicy: Constants.DEFAULT_INGRESS_NETWORK_POLICY_APPS,
            egressNetworkPolicy: Constants.DEFAULT_EGRESS_NETWORK_POLICY_APPS,
            envVars: `USER_UID=1000
USER_GID=1000
FORGEJO__database__DB_TYPE=sqlite3
`,
            useNetworkPolicy: true,
            networkPolicyMode: Constants.DEFAULT_NETWORK_POLICY_MODE_APPS,
            healthCheckPeriodSeconds: Constants.DEFAULT_HEALTH_CHECK_PERIOD_SECONDS,
            healthCheckTimeoutSeconds: Constants.DEFAULT_HEALTH_CHECK_TIMEOUT_SECONDS,
            healthCheckFailureThreshold: Constants.DEFAULT_HEALTH_CHECK_FAILURE_THRESHOLD,
        },
        appDomains: [],
        appVolumes: [{
            size: 2000,
            containerMountPath: '/data',
            accessMode: 'ReadWriteOnce',
            storageClassName: 'longhorn',
            shareWithOtherApps: false,
        }],
        appFileMounts: [],
    }],
};
