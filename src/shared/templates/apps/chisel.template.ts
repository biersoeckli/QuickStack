import { Constants } from "@/shared/utils/constants";
import { AppTemplateContentModel, AppTemplateModel } from "../../model/app-template.model";
import { AppExtendedModel } from "@/shared/model/app-extended.model";
import crypto from "crypto";

export function getChiselAppTemplate(config?: {
    appName?: string,
    username?: string,
    password?: string
}): AppTemplateContentModel {
    return {
        inputSettings: [
            {
                key: "containerImageSource",
                label: "Container Image",
                value: "jpillora/chisel:latest",
                isEnvVar: false,
                randomGeneratedIfEmpty: false,
            },
            {
                key: "CHISEL_USER",
                label: "Username",
                value: config?.username || "chisel",
                isEnvVar: true,
                randomGeneratedIfEmpty: false,
            },
            {
                key: "CHISEL_PASSWORD",
                label: "Password",
                value: config?.password || "",
                isEnvVar: true,
                randomGeneratedIfEmpty: true,
            },
        ],
        appModel: {
            name: config?.appName || "Chisel Tunnel",
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
            containerArgs: '["server", "--keyfile", "/etc/chisel/chisel.key", "--auth", "$(CHISEL_USER):$(CHISEL_PASSWORD)", "--reverse"]',
        },
        appDomains: [],
        appVolumes: [],
        appFileMounts: [],
        appPorts: [{
            port: 8080,
        }],
    };
}

export const chiselAppTemplate: AppTemplateModel = {
    name: "Chisel Tunnel",
    iconName: 'chisel.svg',
    templates: [
        getChiselAppTemplate()
    ],
};

export const postCreateChiselAppTemplate = async (createdApps: AppExtendedModel[]): Promise<AppExtendedModel[]> => {
    const app = createdApps[0];

    const { privateKey } = crypto.generateKeyPairSync('ec', {
        namedCurve: 'P-256',
        privateKeyEncoding: { type: 'sec1', format: 'pem' },
        publicKeyEncoding: { type: 'spki', format: 'pem' },
    });

    app.appFileMounts.push({
        containerMountPath: '/etc/chisel/chisel.key',
        content: privateKey,
    } as any);

    return [app];
};