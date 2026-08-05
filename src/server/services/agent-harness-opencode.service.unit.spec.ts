import { ServiceException } from "@/shared/model/service.exception.model";
import agentHarnessOpenCodeService from "./agent-harness-opencode.service";
import type { AgentExtendedModel } from "@/shared/model/agent-extended.model";
import type { LiteLlmModelMetadata } from "../adapter/litellm-api.adapter";

const modelMetadata: Record<string, LiteLlmModelMetadata> = {
    'moonshotai/Kimi-K2.6': {
        modelName: 'moonshotai/Kimi-K2.6',
        displayName: 'Kimi K2.6',
        contextLimit: 128000,
        outputLimit: 8192,
        supportsReasoning: true,
        defaultReasoningEffort: 'medium',
        reasoningSummary: 'auto',
    },
    'deepseek-v4-pro': {
        modelName: 'deepseek-v4-pro',
        contextLimit: 64000,
    },
};

function makeAgent(overrides: Partial<AgentExtendedModel> = {}): AgentExtendedModel {
    return {
        id: 'agent-1',
        name: 'Agent One',
        projectId: 'proj-test-agent',
        llmGatewayId: 'gateway-1',
        modelAlias: ['moonshotai/Kimi-K2.6', 'deepseek-v4-pro', 'gemini/gemini-flash-lite-latest'],
        sourceType: 'CONTAINER',
        buildMethod: 'DOCKERFILE',
        containerImageSource: 'custom/opencode:latest',
        containerRegistryUsername: null,
        containerRegistryPassword: null,
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
        encryptedEnvVars: null,
        containerCommand: null,
        containerArgs: null,
        workingDir: null,
        warmPoolReplicas: 0,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
        project: { id: 'proj-test-agent', name: 'Project', projectType: 'AGENT', createdAt: new Date('2026-01-01T00:00:00Z'), updatedAt: new Date('2026-01-01T00:00:00Z') },
        llmGateway: { baseUrl: 'https://litellm.example.com' },
        agentDomains: [],
        agentVolumes: [],
        agentFileMounts: [],
        agentGitSshKey: null,
        agentNetworkPolicy: null,
        ...overrides,
    } as AgentExtendedModel;
}

describe('agent-harness-opencode.service', () => {
    it('builds OpenCode config from Agent model aliases and LiteLLM metadata', () => {
        const config = agentHarnessOpenCodeService.buildConfig(makeAgent(), modelMetadata) as any;

        expect(config).toEqual(expect.objectContaining({
            $schema: 'https://opencode.ai/config.json',
            model: 'quickstack-litellm/moonshotai/Kimi-K2.6',
            server: { hostname: '0.0.0.0', port: 4096 },
        }));
        expect(config.provider['quickstack-litellm']).toEqual(expect.objectContaining({
            npm: '@ai-sdk/openai-compatible',
            name: 'QuickStack LiteLLM',
            options: {
                baseURL: 'https://litellm.example.com/v1',
                apiKey: '{env:QS_VIRTUAL_KEY}',
            },
            models: {
                'moonshotai/Kimi-K2.6': {
                    name: 'Kimi K2.6',
                    limit: { context: 128000, output: 8192 },
                    options: {
                        reasoningEffort: 'medium',
                        reasoningSummary: 'auto',
                    },
                    variants: {
                        reasoning: {
                            reasoningEffort: 'medium',
                            reasoningSummary: 'auto',
                        },
                    },
                },
                'deepseek-v4-pro': {
                    name: 'deepseek-v4-pro',
                    limit: { context: 64000 },
                },
                'gemini/gemini-flash-lite-latest': { name: 'gemini/gemini-flash-lite-latest' },
            },
        }));
    });

    it('requires at least one model alias', () => {
        expect(() => agentHarnessOpenCodeService.buildConfig(makeAgent({
            modelAlias: [],
        }), modelMetadata)).toThrow(ServiceException);
    });
});
