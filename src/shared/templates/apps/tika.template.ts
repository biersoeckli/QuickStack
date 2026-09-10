import { Constants } from "@/shared/utils/constants";
import { AppTemplateModel } from "../../model/app-template.model";

export const tikaAppTemplate: AppTemplateModel = {
    name: "Apache Tika",
    description: 'A content-detection and extraction service for documents, images, archives, and metadata.',
    websiteUrl: 'https://github.com/apache/tika',
    iconName: 'tika.png',
    templates: [{
        inputSettings: [
            {
                key: "containerImageSource",
                label: "Container Image",
                value: "apache/tika:latest-full",
                isEnvVar: false,
                randomGeneratedIfEmpty: false,
            },
        ],
        appModel: {
            name: "Apache Tika",
            appType: 'APP',
            sourceType: 'CONTAINER',
            containerImageSource: "",
            replicas: 1,
            envVars: ``,
            useNetworkPolicy: true,
            healthCheckPeriodSeconds: Constants.DEFAULT_HEALTH_CHECK_PERIOD_SECONDS,
            healthCheckTimeoutSeconds: Constants.DEFAULT_HEALTH_CHECK_TIMEOUT_SECONDS,
            healthCheckFailureThreshold: Constants.DEFAULT_HEALTH_CHECK_FAILURE_THRESHOLD,
        },
        appDomains: [],
        appVolumes: [],
        appFileMounts: [],
    }],
};
