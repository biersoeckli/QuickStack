import { Constants } from "@/shared/utils/constants";
import { AppTemplateModel } from "../../model/app-template.model";

export const photoprismAppTemplate: AppTemplateModel = {
    name: "PhotoPrism",
    iconName: 'https://raw.githubusercontent.com/photoprism/photoprism/develop/assets/static/icons/logo.svg',
    templates: [{
        inputSettings: [
            {
                key: "containerImageSource",
                label: "Container Image",
                value: "photoprism/photoprism:latest",
                isEnvVar: false,
                randomGeneratedIfEmpty: false,
            },
            {
                key: "PHOTOPRISM_ADMIN_PASSWORD",
                label: "Admin Password",
                value: "",
                isEnvVar: true,
                randomGeneratedIfEmpty: true,
            },
        ],
        appModel: {
            name: "PhotoPrism",
            appType: 'APP',
            sourceType: 'CONTAINER',
            containerImageSource: "",
            replicas: 1,
            ingressNetworkPolicy: Constants.DEFAULT_INGRESS_NETWORK_POLICY_APPS,
            egressNetworkPolicy: Constants.DEFAULT_EGRESS_NETWORK_POLICY_APPS,
            envVars: `PHOTOPRISM_UPLOAD_NSFW=true
PHOTOPRISM_DETECT_NSFW=false
PHOTOPRISM_EXPERIMENTAL=false
PHOTOPRISM_DATABASE_DRIVER=sqlite
`,
            useNetworkPolicy: true,
            healthCheckPeriodSeconds: 60,
            healthCheckTimeoutSeconds: 30,
            healthCheckFailureThreshold: Constants.DEFAULT_HEALTH_CHECK_FAILURE_THRESHOLD,
        },
        appDomains: [],
        appVolumes: [{
            size: 500,
            containerMountPath: '/photoprism/storage',
            accessMode: 'ReadWriteOnce',
            storageClassName: 'longhorn',
            shareWithOtherApps: false,
        }, {
            size: 10000,
            containerMountPath: '/photoprism/originals',
            accessMode: 'ReadWriteOnce',
            storageClassName: 'longhorn',
            shareWithOtherApps: false,
        }],
        appFileMounts: [],
        appPorts: [{
            port: 2342,
        }]
    }],
};
