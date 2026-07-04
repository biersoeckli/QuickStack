import { ServiceException } from "@/shared/model/service.exception.model";

type LiteLlmModelInfoResponse = {
    data?: LiteLlmModelInfo[];
};

export type LiteLlmModelInfo = {
    model_name?: string;
    model_info?: Record<string, unknown> | null;
    litellm_params?: Record<string, unknown> | null;
    [key: string]: unknown;
};

export type LiteLlmModelMetadata = {
    modelName: string;
    displayName?: string;
    contextLimit?: number;
    outputLimit?: number;
    supportsReasoning?: boolean;
    reasoningType?: string;
    defaultReasoningEffort?: string;
    reasoningSummary?: string;
    textVerbosity?: string;
    thinkingBudgetTokens?: number;
};

// todo use the swagger api
class LiteLlmApiAdapter {
    private async fetchJson<T>(baseUrl: string, adminKey: string, path: string, init?: RequestInit): Promise<T> {
        let response: Response;
        try {
            response = await fetch(`${baseUrl}${path}`, {
                ...init,
                headers: {
                    accept: 'application/json',
                    authorization: `Bearer ${adminKey}`,
                    ...(init?.method === 'POST' ? { 'content-type': 'application/json' } : {}),
                    ...(init?.headers ? (init.headers as Record<string, string>) : {}),
                },
                cache: 'no-store',
            });
        } catch (error) {
            throw new ServiceException(`Could not reach LiteLLM Gateway: ${error instanceof Error ? error.message : 'Network request failed.'}`);
        }

        if (response.status === 401 || response.status === 403) {
            throw new ServiceException('LiteLLM authentication failed. Please check the LiteLLM Admin Key.');
        }

        if (!response.ok) {
            const responseText = await response.text().catch(() => '');
            throw new ServiceException(`LiteLLM request failed with status ${response.status}${responseText ? `: ${responseText}` : '.'}`);
        }

        try {
            return await response.json() as T;
        } catch {
            throw new ServiceException('LiteLLM returned an invalid JSON response.');
        }
    }

    async createVirtualKey(baseUrl: string, adminKey: string, modelAliases: string[]): Promise<string> {
        const response = await this.fetchJson<{ key?: string }>(baseUrl, adminKey, '/key/generate', {
            method: 'POST',
            body: JSON.stringify({ models: modelAliases }),
        });

        if (!response.key) {
            throw new ServiceException('LiteLLM virtual key response did not contain a key field.');
        }
        return response.key;
    }

    async deleteVirtualKey(baseUrl: string, adminKey: string, key: string): Promise<void> {
        await this.fetchJson<unknown>(baseUrl, adminKey, '/key/delete', {
            method: 'POST',
            body: JSON.stringify({ keys: [key] }),
        });
    }

    async listModelAliases(baseUrl: string, adminKey: string): Promise<string[]> {
        return (await this.listModelInfo(baseUrl, adminKey)).map((item) => item.modelName);
    }

    async listModelInfo(baseUrl: string, adminKey: string): Promise<LiteLlmModelMetadata[]> {
        const response = await this.fetchJson<LiteLlmModelInfoResponse>(baseUrl, adminKey, '/model/info');
        if (!response.data || !Array.isArray(response.data)) {
            throw new ServiceException('LiteLLM returned an unexpected model info payload.');
        }

        const byName = new Map<string, LiteLlmModelMetadata>();
        for (const item of response.data) {
            const metadata = this.toModelMetadata(item);
            if (metadata) {
                byName.set(metadata.modelName, metadata);
            }
        }

        return Array.from(byName.values()).sort((a, b) => a.modelName.localeCompare(b.modelName));
    }

    private toModelMetadata(item: LiteLlmModelInfo): LiteLlmModelMetadata | null {
        const modelName = this.readString(item.model_name);
        if (!modelName) {
            return null;
        }

        const modelInfo = this.readObject(item.model_info);
        const litellmParams = this.readObject(item.litellm_params);
        const metadata = this.readObject(modelInfo?.metadata);

        return {
            modelName,
            displayName: this.firstString(modelInfo, metadata, ['display_name', 'displayName', 'name']),
            contextLimit: this.firstNumber(modelInfo, metadata, item, ['max_input_tokens', 'max_context_tokens', 'max_context_length', 'context_window', 'max_tokens']),
            outputLimit: this.firstNumber(modelInfo, metadata, litellmParams, item, ['max_output_tokens', 'max_completion_tokens', 'output_token_limit']),
            supportsReasoning: this.firstBoolean(modelInfo, metadata, ['supports_reasoning', 'supportsReasoning', 'reasoning']),
            reasoningType: this.firstString(modelInfo, metadata, ['reasoning_type', 'reasoningType']),
            defaultReasoningEffort: this.firstString(modelInfo, metadata, litellmParams, ['default_reasoning_effort', 'defaultReasoningEffort', 'reasoning_effort', 'reasoningEffort']),
            reasoningSummary: this.firstString(modelInfo, metadata, litellmParams, ['reasoning_summary', 'reasoningSummary']),
            textVerbosity: this.firstString(modelInfo, metadata, litellmParams, ['text_verbosity', 'textVerbosity']),
            thinkingBudgetTokens: this.firstNumber(modelInfo, metadata, litellmParams, ['thinking_budget_tokens', 'thinkingBudgetTokens', 'budget_tokens', 'budgetTokens']),
        };
    }

    private readObject(value: unknown): Record<string, unknown> | undefined {
        return value && typeof value === 'object' && !Array.isArray(value)
            ? value as Record<string, unknown>
            : undefined;
    }

    private readString(value: unknown): string | undefined {
        return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
    }

    private readNumber(value: unknown): number | undefined {
        const numberValue = typeof value === 'number'
            ? value
            : typeof value === 'string' && value.trim().length > 0
                ? Number(value)
                : NaN;
        return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : undefined;
    }

    private readBoolean(value: unknown): boolean | undefined {
        if (typeof value === 'boolean') {
            return value;
        }
        if (typeof value === 'string') {
            if (value.toLowerCase() === 'true') {
                return true;
            }
            if (value.toLowerCase() === 'false') {
                return false;
            }
        }
        return undefined;
    }

    private firstString(...args: [...Array<Record<string, unknown> | undefined>, string[]]): string | undefined {
        const keys = args[args.length - 1] as string[];
        const sources = args.slice(0, -1) as Array<Record<string, unknown> | undefined>;
        for (const source of sources) {
            for (const key of keys) {
                const value = this.readString(source?.[key]);
                if (value) {
                    return value;
                }
            }
        }
        return undefined;
    }

    private firstNumber(...args: [...Array<Record<string, unknown> | undefined>, string[]]): number | undefined {
        const keys = args[args.length - 1] as string[];
        const sources = args.slice(0, -1) as Array<Record<string, unknown> | undefined>;
        for (const source of sources) {
            for (const key of keys) {
                const value = this.readNumber(source?.[key]);
                if (value) {
                    return value;
                }
            }
        }
        return undefined;
    }

    private firstBoolean(...args: [...Array<Record<string, unknown> | undefined>, string[]]): boolean | undefined {
        const keys = args[args.length - 1] as string[];
        const sources = args.slice(0, -1) as Array<Record<string, unknown> | undefined>;
        for (const source of sources) {
            for (const key of keys) {
                const value = this.readBoolean(source?.[key]);
                if (value !== undefined) {
                    return value;
                }
            }
        }
        return undefined;
    }
}

const liteLlmApiAdapter = new LiteLlmApiAdapter();
export default liteLlmApiAdapter;
