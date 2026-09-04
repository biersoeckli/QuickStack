import agentHarnessConfigService, { CliHarness } from "@/server/services/agent-harness-config.service";
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

const bootstrapCommand = 'exec /bin/sh /workspace/quickstack-bootstrap.sh';
export const opencodeCliAgentTemplate = createTemplate({ name: 'OpenCode CLI', image: 'ghcr.io/anomalyco/opencode:1.18.27', iconName: 'https://opencode.ai/favicon.svg', command: 'exec sleep infinity' });
export const geminiCliAgentTemplate = createTemplate({ name: 'Gemini CLI', image: 'us-docker.pkg.dev/gemini-code-dev/gemini-cli/sandbox:0.42.0-nightly.20260428.g59b2dea0e', command: bootstrapCommand });
export const copilotCliAgentTemplate = createTemplate({ name: 'GitHub Copilot CLI', image: 'node:24-bookworm', command: bootstrapCommand });
export const claudeCodeAgentTemplate = createTemplate({ name: 'Claude Code CLI', image: 'node:24-bookworm', command: bootstrapCommand });
export const deepSeekHarnessCliAgentTemplate = createTemplate({ name: 'DeepSeek Harness CLI', image: 'node:24-bookworm', command: bootstrapCommand });

export const postCreateCliHarnessTemplate = async (createdAgents: AgentExtendedModel[], context: AgentTemplatePostCreateContext): Promise<AgentExtendedModel[]> => {
    const agent = createdAgents[0];
    if (!agent) return createdAgents;
    const harnessByTemplate: Record<string, CliHarness> = {
        'Gemini CLI': 'gemini',
        'GitHub Copilot CLI': 'copilot',
        'Claude Code CLI': 'claude',
        'DeepSeek Harness CLI': 'deepseek',
    };
    const harness = harnessByTemplate[context.templateName];
    const mounts: AgentFileMount[] = [{
        containerMountPath: '/workspace/quickstack-harness.env',
        content: agentHarnessConfigService.buildEnvironment(agent),
    } as AgentFileMount];
    if (harness) {
        mounts.push({ containerMountPath: '/workspace/quickstack-bootstrap.sh', content: agentHarnessConfigService.buildBootstrapScript(agent, harness) } as AgentFileMount);
    }
    if (harness === 'deepseek') {
        mounts.push({ containerMountPath: '/workspace/quickstack-dsh-settings.yaml', content: agentHarnessConfigService.buildDeepSeekConfig(agent) } as AgentFileMount);
    }
    agent.agentFileMounts = mounts;
    return [agent];
};
