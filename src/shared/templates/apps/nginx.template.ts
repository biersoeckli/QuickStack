import { Constants } from "@/shared/utils/constants";
import { AppTemplateModel } from "../../model/app-template.model";

export const nginxAppTemplate: AppTemplateModel = {
    name: "NGINX",
    description: 'A high-performance web server, reverse proxy, and load balancer.',
    websiteUrl: 'https://github.com/nginx/nginx',
    iconName: 'nginx.svg',
    templates: [{
        inputSettings: [
            {
                key: "containerImageSource",
                label: "Container Image",
                value: "nginx:alpine",
                isEnvVar: false,
                randomGeneratedIfEmpty: false,
            },
        ],
        appModel: {
            name: "NGINX",
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
