import agentHarnessOpenCodeService from "@/server/services/agent-harness-opencode.service";
import agentHarnessConfigService from "@/server/services/agent-harness-config.service";
import { AgentExtendedModel } from "@/shared/model/agent-extended.model";
import { AgentTemplateModel, AgentTemplatePostCreateContext } from "@/shared/model/agent-template.model";
import { AgentFileMount } from "@prisma/client";

export const opencodeAgentTemplate: AgentTemplateModel = {
    name: "OpenCode",
    iconName: "https://opencode.ai/favicon.svg",
    templates: [{
        inputSettings: [
            {
                key: "containerImageSource",
                label: "Container Image",
                value: "quickstack/agent-opencode:1.18.27",
                isEnvVar: false,
                randomGeneratedIfEmpty: false,
            },
        ],
        name: "OpenCode",
        sourceType: "CONTAINER",
        buildMethod: "DOCKERFILE",
        containerImageSource: "",
        containerRegistryUsername: null,
        containerRegistryPassword: null,
        llmGatewayId: '',
        modelAlias: [],
        gitUrl: null,
        gitBranch: null,
        gitUsername: null,
        gitToken: null,
        dockerfilePath: "./Dockerfile",
        cpuRequest: null,
        cpuLimit: null,
        memoryRequest: null,
        memoryLimit: null,
        systemPrompt: null,
        encryptedEnvVars: undefined,
        containerCommand: JSON.stringify([
            "/bin/sh",
            "-lc"
        ]),
        containerArgs: JSON.stringify([
            "exec opencode web --hostname 0.0.0.0 --port 4096"
        ]),
        workingDir: '/workspace',
        warmPoolReplicas: 0,
        deployFileBrowser: false,
        healthCheckPeriodSeconds: 15,
        healthCheckTimeoutSeconds: 5,
        healthCheckFailureThreshold: 3,
        agentDomains: [],
        agentVolumes: [{
            containerMountPath: "/workspace",
            size: 5120,
            storageClassName: "longhorn",
        }],
        agentFileMounts: [],
        agentNetworkPolicy: null,
    }],
};


export const postCreateOpencodeAppTemplate = async (createdAgents: AgentExtendedModel[], _context: AgentTemplatePostCreateContext): Promise<AgentExtendedModel[]> => {

    const createdAgent = createdAgents[0];

    const opencodeConfig = agentHarnessOpenCodeService.buildConfig(createdAgent);
    createdAgent.agentFileMounts = [
        {
            containerMountPath: '/etc/quickstack/harness.env',
            content: agentHarnessConfigService.buildEnvironment(createdAgent),
        } as AgentFileMount,
        {
            containerMountPath: '/root/.config/opencode/opencode.json',
            content: JSON.stringify(opencodeConfig, null, 2),
        } as AgentFileMount
    ];

    return [createdAgent]
};
