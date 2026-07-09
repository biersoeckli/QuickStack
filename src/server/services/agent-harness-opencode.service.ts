import { ServiceException } from "@/shared/model/service.exception.model";
import { AgentModelAliasUtils } from "../utils/agent-model-alias.utils";
import type { LiteLlmModelMetadata } from "../adapter/litellm-api.adapter";
import type { AgentHarnessService } from "./agent-harness.interface";
import { AgentExtendedModel } from "@/shared/model/agent-extended.model";

const OPENCODE_PROVIDER_ID = 'quickstack-litellm';

const OPENCODE_WEB_PORT = 4096;

class AgentHarnessOpenCodeService implements AgentHarnessService {

    private normalizeLiteLlmBaseUrl(baseUrl: string): string {
        const trimmed = baseUrl.trim().replace(/\/+$/, '');
        if (!trimmed) {
            throw new ServiceException('LLM Gateway base URL is missing for Agent.');
        }
        return trimmed.endsWith('/v1') ? trimmed : `${trimmed}/v1`;
    }

    private buildModelConfig(modelAlias: string, metadata?: LiteLlmModelMetadata) {
        const limit = {
            ...(metadata?.contextLimit ? { context: metadata.contextLimit } : {}),
            ...(metadata?.outputLimit ? { output: metadata.outputLimit } : {}),
        };
        const options = {
            ...(metadata?.defaultReasoningEffort ? { reasoningEffort: metadata.defaultReasoningEffort } : {}),
            ...(metadata?.reasoningSummary ? { reasoningSummary: metadata.reasoningSummary } : {}),
            ...(metadata?.textVerbosity ? { textVerbosity: metadata.textVerbosity } : {}),
            ...(metadata?.thinkingBudgetTokens ? { thinking: { type: 'enabled', budgetTokens: metadata.thinkingBudgetTokens } } : {}),
        };
        const variants = metadata?.supportsReasoning ? {
            reasoning: {
                ...(metadata.defaultReasoningEffort ? { reasoningEffort: metadata.defaultReasoningEffort } : {}),
                ...(metadata.reasoningSummary ? { reasoningSummary: metadata.reasoningSummary } : {}),
                ...(metadata.textVerbosity ? { textVerbosity: metadata.textVerbosity } : {}),
                ...(metadata.thinkingBudgetTokens ? { thinking: { type: 'enabled', budgetTokens: metadata.thinkingBudgetTokens } } : {}),
            },
        } : undefined;

        return {
            name: metadata?.displayName ?? modelAlias,
            ...(Object.keys(limit).length > 0 ? { limit } : {}),
            ...(Object.keys(options).length > 0 ? { options } : {}),
            ...(variants ? { variants } : {}),
        };
    }

    buildConfig(agent: AgentExtendedModel, modelMetadata?: Record<string, LiteLlmModelMetadata>): unknown {
        const modelAliases = AgentModelAliasUtils.normalize(agent.modelAlias);
        const defaultModelAlias = modelAliases[0];
        if (!defaultModelAlias) {
            throw new ServiceException('At least one model alias must be selected for Agent.');
        }
        return {
            $schema: 'https://opencode.ai/config.json',
            model: `${OPENCODE_PROVIDER_ID}/${defaultModelAlias}`,
            enabled_providers: [OPENCODE_PROVIDER_ID],
            provider: {
                [OPENCODE_PROVIDER_ID]: {
                    npm: '@ai-sdk/openai-compatible',
                    name: 'QuickStack LiteLLM',
                    options: {
                        baseURL: this.normalizeLiteLlmBaseUrl(agent.llmGateway?.baseUrl || ''),
                        apiKey: '{env:QS_VIRTUAL_KEY}',
                    },
                    models: Object.fromEntries(modelAliases.map((modelAlias) => [
                        modelAlias,
                        this.buildModelConfig(modelAlias, modelMetadata?.[modelAlias]),
                    ])),
                },
            },
            server: {
                hostname: '0.0.0.0',
                port: OPENCODE_WEB_PORT,
            },
        };
    }
}

const agentHarnessOpenCodeService = new AgentHarnessOpenCodeService();
export default agentHarnessOpenCodeService;
