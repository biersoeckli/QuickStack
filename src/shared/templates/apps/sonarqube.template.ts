import { Constants } from "@/shared/utils/constants";
import { AppTemplateModel } from "../../model/app-template.model";

export const sonarqubeAppTemplate: AppTemplateModel = {
    name: "SonarQube",
    iconName: 'https://avatars.githubusercontent.com/u/54465?s=200&v=4',
    templates: [{
        inputSettings: [
            {
                key: "containerImageSource",
                label: "Container Image",
                value: "sonarqube:community",
                isEnvVar: false,
                randomGeneratedIfEmpty: false,
            },
        ],
        appModel: {
            name: "SonarQube",
            appType: 'APP',
            sourceType: 'CONTAINER',
            containerImageSource: "",
            replicas: 1,
            ingressNetworkPolicy: Constants.DEFAULT_INGRESS_NETWORK_POLICY_APPS,
            egressNetworkPolicy: Constants.DEFAULT_EGRESS_NETWORK_POLICY_APPS,
            envVars: `SONAR_ES_BOOTSTRAP_CHECKS_DISABLE=true
`,
            useNetworkPolicy: true,
            healthCheckPeriodSeconds: 60,
            healthCheckTimeoutSeconds: 30,
            healthCheckFailureThreshold: Constants.DEFAULT_HEALTH_CHECK_FAILURE_THRESHOLD,
        },
        appDomains: [],
        appVolumes: [{
            size: 1000,
            containerMountPath: '/opt/sonarqube/data',
            accessMode: 'ReadWriteOnce',
            storageClassName: 'longhorn',
            shareWithOtherApps: false,
        }, {
            size: 200,
            containerMountPath: '/opt/sonarqube/extensions',
            accessMode: 'ReadWriteOnce',
            storageClassName: 'longhorn',
            shareWithOtherApps: false,
        }],
        appFileMounts: [],
        appPorts: [{
            port: 9000,
        }]
    }],
};
