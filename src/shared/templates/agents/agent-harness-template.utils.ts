import { AgentExtendedModel } from "@/shared/model/agent-extended.model";
import { AgentTemplateModel } from "@/shared/model/agent-template.model";
import { ServiceException } from "@/shared/model/service.exception.model";
import { AgentModelAliasUtils } from "@/server/utils/agent-model-alias.utils";

export const HARNESS_VIRTUAL_KEY_REFERENCE = '__quickstack_runtime_virtual_key__';

type HarnessEnvironmentVariable = {
    name: string;
    value: string;
};

type CliAgentTemplateMetadata = {
    iconName: string;
    description: string;
    websiteUrl: string;
};

const workspaceVolume = [{
    containerMountPath: '/workspace',
    size: 5120,
    storageClassName: 'longhorn',
}];

export function createCliAgentTemplate(
    name: string,
    image: string,
    command: string,
    metadata: CliAgentTemplateMetadata,
): AgentTemplateModel {
    return {
        name,
        ...metadata,
        templates: [{
            inputSettings: [{
                key: 'containerImageSource',
                label: 'Container Image',
                value: image,
                isEnvVar: false,
                randomGeneratedIfEmpty: false,
            }],
            name,
            sourceType: 'CONTAINER',
            buildMethod: 'DOCKERFILE',
            containerImageSource: '',
            containerRegistryUsername: null,
            containerRegistryPassword: null,
            llmGatewayId: '',
            modelAlias: [],
            gitUrl: null,
            gitBranch: null,
            gitUsername: null,
            gitToken: null,
            dockerfilePath: './Dockerfile',
            cpuRequest: null,
            cpuLimit: null,
            memoryRequest: null,
            memoryLimit: null,
            systemPrompt: null,
            encryptedEnvVars: undefined,
            containerCommand: JSON.stringify(['/bin/sh', '-lc']),
            containerArgs: JSON.stringify([command]),
            workingDir: '/workspace',
            warmPoolReplicas: 0,
            deployFileBrowser: false,
            healthCheckPeriodSeconds: 15,
            healthCheckTimeoutSeconds: 5,
            healthCheckFailureThreshold: 3,
            agentDomains: [],
            agentVolumes: workspaceVolume,
            agentFileMounts: [],
            agentNetworkPolicy: null,
        }],
    };
}

export function buildLiteLlmEnvironment(agent: AgentExtendedModel): {
    baseUrl: string;
    gatewayBaseUrl: string;
    defaultModelAlias: string;
    modelAliases: string[];
    environment: string;
} {
    const configuredBaseUrl = agent.llmGateway?.baseUrl?.trim().replace(/\/+$/, '');
    if (!configuredBaseUrl) throw new ServiceException('LLM Gateway base URL is missing for Agent.');
    const gatewayBaseUrl = configuredBaseUrl.endsWith('/v1')
        ? configuredBaseUrl.slice(0, -3)
        : configuredBaseUrl;
    const modelAliases = AgentModelAliasUtils.normalize(agent.modelAlias);
    const defaultModelAlias = modelAliases[0];
    if (!defaultModelAlias) throw new ServiceException('At least one model alias must be selected for Agent.');
    const baseUrl = `${gatewayBaseUrl}/v1`;
    return {
        baseUrl,
        gatewayBaseUrl,
        defaultModelAlias,
        modelAliases,
        environment: [
            `QS_LITELLM_BASE_URL=${baseUrl}`,
            `QS_LITELLM_GATEWAY_BASE_URL=${gatewayBaseUrl}`,
            `QS_MODEL_ALIAS=${defaultModelAlias}`,
            `QS_MODEL_ALIASES=${JSON.stringify(modelAliases)}`,
            '',
        ].join('\n'),
    };
}

export function setHarnessRuntimeEnvironment(
    agent: AgentExtendedModel,
    config: ReturnType<typeof buildLiteLlmEnvironment>,
    harnessEnvironment: HarnessEnvironmentVariable[],
): void {
    agent.encryptedEnvVars = JSON.stringify([
        { name: 'QS_LITELLM_BASE_URL', value: config.baseUrl },
        { name: 'QS_LITELLM_GATEWAY_BASE_URL', value: config.gatewayBaseUrl },
        { name: 'QS_MODEL_ALIAS', value: config.defaultModelAlias },
        { name: 'QS_MODEL_ALIASES', value: JSON.stringify(config.modelAliases) },
        ...harnessEnvironment,
    ]);
}
