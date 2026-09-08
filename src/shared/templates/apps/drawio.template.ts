import { Constants } from "@/shared/utils/constants";
import { AppTemplateModel } from "../../model/app-template.model";

export const drawioAppTemplate: AppTemplateModel = {
    name: "draw.io",
    description: 'A browser-based diagram editor for flowcharts, architecture diagrams, and visual documentation.',
    websiteUrl: 'https://github.com/jgraph/drawio',
    iconName: 'https://raw.githubusercontent.com/jgraph/drawio/dev/src/main/webapp/images/drawlogo.svg',
    templates: [{
        inputSettings: [
            {
                key: "containerImageSource",
                label: "Container Image",
                value: "jgraph/drawio:latest",
                isEnvVar: false,
                randomGeneratedIfEmpty: false,
            },
        ],
        appModel: {
            name: "draw.io",
            appType: 'APP',
            sourceType: 'CONTAINER',
            containerImageSource: "",
            replicas: 1,
            envVars: ``,
            useNetworkPolicy: true,
            healthCheckPeriodSeconds: 15,
            healthCheckTimeoutSeconds: 5,
            healthCheckFailureThreshold: Constants.DEFAULT_HEALTH_CHECK_FAILURE_THRESHOLD,
        },
        appDomains: [],
        appVolumes: [],
        appFileMounts: [],
    }],
};
