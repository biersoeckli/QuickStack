import agentHarnessConfigService from "@/server/services/agent-harness-config.service";
import { AgentExtendedModel } from "@/shared/model/agent-extended.model";
import { AgentTemplateModel, AgentTemplatePostCreateContext } from "@/shared/model/agent-template.model";
import { AgentFileMount } from "@prisma/client";

type HarnessTemplateOptions = { name: string; image: string; iconName?: string | null; command: string; };

const workspaceVolume = [{ containerMountPath: '/workspace', size: 5120, storageClassName: 'longhorn' }];

function createTemplate({ name, image, iconName, command }: HarnessTemplateOptions): AgentTemplateModel {
    return {
        name,
        iconName,
        templates: [{
            inputSettings: [{ key: 'containerImageSource', label: 'Container Image', value: image, isEnvVar: false, randomGeneratedIfEmpty: false }],
            name,
            sourceType: 'CONTAINER', buildMethod: 'DOCKERFILE', containerImageSource: '',
            containerRegistryUsername: null, containerRegistryPassword: null,
            llmGatewayId: '', modelAlias: [], gitUrl: null, gitBranch: null, gitUsername: null, gitToken: null,
            dockerfilePath: './Dockerfile', cpuRequest: null, cpuLimit: null, memoryRequest: null, memoryLimit: null,
            systemPrompt: null, encryptedEnvVars: undefined,
            containerCommand: JSON.stringify(['/bin/sh', '-lc']), containerArgs: JSON.stringify([command]),
            workingDir: '/workspace', warmPoolReplicas: 0, deployFileBrowser: false,
            healthCheckPeriodSeconds: 15, healthCheckTimeoutSeconds: 5, healthCheckFailureThreshold: 3,
            agentDomains: [], agentVolumes: workspaceVolume, agentFileMounts: [], agentNetworkPolicy: null,
        }],
    };
}

export const opencodeCliAgentTemplate = createTemplate({ name: 'OpenCode CLI', image: 'quickstack/agent-opencode:1.18.27', iconName: 'https://opencode.ai/favicon.svg', command: 'exec sleep infinity' });
export const geminiCliAgentTemplate = createTemplate({ name: 'Gemini CLI', image: 'quickstack/agent-gemini-cli:0.58.0', command: 'exec sleep infinity' });
export const copilotCliAgentTemplate = createTemplate({ name: 'GitHub Copilot CLI', image: 'quickstack/agent-copilot-cli:1.0.82', command: 'exec sleep infinity' });
export const claudeCodeAgentTemplate = createTemplate({ name: 'Claude Code CLI', image: 'quickstack/agent-claude-code:2.1.260', command: 'exec sleep infinity' });
export const deepSeekHarnessWebAgentTemplate = createTemplate({ name: 'DeepSeek Harness Web', image: 'quickstack/agent-deepseek-harness:0.1.2-rc.1', command: 'exec qs-dsh web --no-open --host 0.0.0.0 --port 3080' });
export const deepSeekHarnessCliAgentTemplate = createTemplate({ name: 'DeepSeek Harness CLI', image: 'quickstack/agent-deepseek-harness:0.1.2-rc.1', command: 'exec sleep infinity' });

export const postCreateCliHarnessTemplate = async (createdAgents: AgentExtendedModel[], context: AgentTemplatePostCreateContext): Promise<AgentExtendedModel[]> => {
    const agent = createdAgents[0];
    if (!agent) return createdAgents;
    const mounts: AgentFileMount[] = [{
        containerMountPath: '/etc/quickstack/harness.env',
        content: agentHarnessConfigService.buildEnvironment(agent),
    } as AgentFileMount];
    if (context.templateName.startsWith('DeepSeek Harness')) {
        mounts.push({ containerMountPath: '/root/.dsh/settings.yaml', content: agentHarnessConfigService.buildDeepSeekConfig(agent) } as AgentFileMount);
    }
    agent.agentFileMounts = mounts;
    return [agent];
};
