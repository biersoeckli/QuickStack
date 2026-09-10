import { Constants } from "@/shared/utils/constants";
import { AppTemplateModel } from "../../model/app-template.model";

export const jenkinsAppTemplate: AppTemplateModel = {
    name: "Jenkins",
    description: 'A widely used automation server for building, testing, and deploying software.',
    websiteUrl: 'https://github.com/jenkinsci/jenkins',
    iconName: 'jenkins.svg',
    templates: [{
        inputSettings: [
            {
                key: "containerImageSource",
                label: "Container Image",
                value: "jenkins/jenkins:lts",
                isEnvVar: false,
                randomGeneratedIfEmpty: false,
            },
        ],
        appModel: {
            name: "Jenkins",
            appType: 'APP',
            sourceType: 'CONTAINER',
            containerImageSource: "",
            replicas: 1,
            envVars: `JAVA_OPTS=-Djenkins.install.runSetupWizard=true
`,
            useNetworkPolicy: true,
            healthCheckPeriodSeconds: 60,
            healthCheckTimeoutSeconds: 30,
            healthCheckFailureThreshold: Constants.DEFAULT_HEALTH_CHECK_FAILURE_THRESHOLD,
        },
        appDomains: [],
        appVolumes: [{
            size: 2000,
            containerMountPath: '/var/jenkins_home',
            accessMode: 'ReadWriteOnce',
            storageClassName: 'longhorn',
            shareWithOtherApps: false,
        }],
        appFileMounts: [],
    }],
};
