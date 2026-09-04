import { AgentExtendedModel } from "@/shared/model/agent-extended.model";
import { ServiceException } from "@/shared/model/service.exception.model";
import { AgentModelAliasUtils } from "../utils/agent-model-alias.utils";

export type AgentHarnessConnection = {
    baseUrl: string;
    gatewayBaseUrl: string;
    defaultModelAlias: string;
    modelAliases: string[];
};

class AgentHarnessConfigService {
    buildConnection(agent: AgentExtendedModel): AgentHarnessConnection {
        const configuredBaseUrl = agent.llmGateway?.baseUrl?.trim().replace(/\/+$/, '');
        if (!configuredBaseUrl) throw new ServiceException('LLM Gateway base URL is missing for Agent.');
        const gatewayBaseUrl = configuredBaseUrl.endsWith('/v1')
            ? configuredBaseUrl.slice(0, -3)
            : configuredBaseUrl;

        const modelAliases = AgentModelAliasUtils.normalize(agent.modelAlias);
        const defaultModelAlias = modelAliases[0];
        if (!defaultModelAlias) throw new ServiceException('At least one model alias must be selected for Agent.');

        return {
            gatewayBaseUrl,
            baseUrl: `${gatewayBaseUrl}/v1`,
            defaultModelAlias,
            modelAliases,
        };
    }

    buildEnvironment(agent: AgentExtendedModel): string {
        const config = this.buildConnection(agent);
        return [
            `QS_LITELLM_BASE_URL=${config.baseUrl}`,
            `QS_LITELLM_GATEWAY_BASE_URL=${config.gatewayBaseUrl}`,
            `QS_MODEL_ALIAS=${config.defaultModelAlias}`,
            `QS_MODEL_ALIASES=${JSON.stringify(config.modelAliases)}`,
            '',
        ].join('\n');
    }

    buildDeepSeekConfig(agent: AgentExtendedModel): string {
        const config = this.buildConnection(agent);
        return [
            'llm-pi-ai:',
            '  providers:',
            '    quickstack-litellm:',
            '      displayName: QuickStack LiteLLM',
            '      apiKeyEnv: QS_VIRTUAL_KEY',
            '      api: openai-completions',
            `      baseURL: ${config.baseUrl}`,
            '      compat:',
            '        supportsDeveloperRole: false',
            '        maxTokensField: max_tokens',
            '      models:',
            ...config.modelAliases.map((model) => `        - id: ${model}`),
            '',
        ].join('\n');
    }
}

const agentHarnessConfigService = new AgentHarnessConfigService();
export default agentHarnessConfigService;
