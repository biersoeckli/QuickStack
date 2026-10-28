import { ServiceException } from "@/shared/model/service.exception.model";
import { ValueFormatUtils } from "@/server/utils/value-format.utils";
import {
    LiteLlmCreateUserRequest,
    LiteLlmCreateUserResponse,
    LiteLlmDeleteKeyRequest,
    LiteLlmGenerateKeyRequest,
    LiteLlmGenerateKeyResponse,
    LiteLlmModelInfo,
    LiteLlmModelInfoResponse,
    LiteLlmUserInfoResponse,
} from "./api-clients/types/litellm.models";
import {
    liteLlmMetadataBooleanZodModel,
    liteLlmMetadataNumberZodModel,
    liteLlmMetadataObjectZodModel,
    liteLlmMetadataStringZodModel,
} from "./litellm-api.models";

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

    async createVirtualKey(
        baseUrl: string,
        adminKey: string,
        modelAliases: string[],
        metadata?: Record<string, unknown>,
        userId?: string,
        teamId?: string,
    ): Promise<string> {
        const requestBody: LiteLlmGenerateKeyRequest = {
            models: modelAliases,
            ...(metadata ? { metadata } : {}),
            ...(userId ? { user_id: userId } : {}),
            ...(teamId ? { team_id: teamId } : {}),
        };
        const response = await this.fetchJson<LiteLlmGenerateKeyResponse>(baseUrl, adminKey, '/key/generate', {
            method: 'POST',
            body: JSON.stringify(requestBody),
        });

        if (!response.key) {
            throw new ServiceException('LiteLLM virtual key response did not contain a key field.');
        }
        return response.key;
    }

    async deleteVirtualKey(baseUrl: string, adminKey: string, key: string): Promise<void> {
        const requestBody: LiteLlmDeleteKeyRequest = { keys: [key] };
        await this.fetchJson<unknown>(baseUrl, adminKey, '/key/delete', {
            method: 'POST',
            body: JSON.stringify(requestBody),
        });
    }

    async getUserById(baseUrl: string, adminKey: string, userId: string): Promise<LiteLlmUserInfoResponse> {
        const query = new URLSearchParams({ user_id: userId });
        return await this.fetchJson<LiteLlmUserInfoResponse>(baseUrl, adminKey, `/user/info?${query}`);
    }

    async getUserByIdOrUndefined(baseUrl: string, adminKey: string, userId: string): Promise<LiteLlmUserInfoResponse | undefined> {
        try {
            return await this.getUserById(baseUrl, adminKey, userId);
        } catch (error) {
            if (error instanceof ServiceException && error.message.startsWith('LiteLLM request failed with status 404')) {
                return undefined;
            }
            throw error;
        }
    }

    async createUserWithId(baseUrl: string, adminKey: string, userId: string): Promise<LiteLlmCreateUserResponse> {
        const requestBody: LiteLlmCreateUserRequest = {
            user_id: userId,
            auto_create_key: false,
        };
        return await this.fetchJson<LiteLlmCreateUserResponse>(baseUrl, adminKey, '/user/new', {
            method: 'POST',
            body: JSON.stringify(requestBody),
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
        const modelName = liteLlmMetadataStringZodModel.safeParse(item.model_name);
        if (!modelName.success) {
            return null;
        }

        const modelInfo = this.readObject(item.model_info);
        const litellmParams = this.readObject(item.litellm_params);
        const metadata = this.readObject(modelInfo?.metadata);

        return {
            modelName: modelName.data,
            displayName: ValueFormatUtils.firstValidValue([modelInfo, metadata], ['display_name', 'displayName', 'name'], liteLlmMetadataStringZodModel),
            contextLimit: ValueFormatUtils.firstValidValue([modelInfo, metadata, item], ['max_input_tokens', 'max_context_tokens', 'max_context_length', 'context_window', 'max_tokens'], liteLlmMetadataNumberZodModel),
            outputLimit: ValueFormatUtils.firstValidValue([modelInfo, metadata, litellmParams, item], ['max_output_tokens', 'max_completion_tokens', 'output_token_limit'], liteLlmMetadataNumberZodModel),
            supportsReasoning: ValueFormatUtils.firstValidValue([modelInfo, metadata], ['supports_reasoning', 'supportsReasoning', 'reasoning'], liteLlmMetadataBooleanZodModel),
            reasoningType: ValueFormatUtils.firstValidValue([modelInfo, metadata], ['reasoning_type', 'reasoningType'], liteLlmMetadataStringZodModel),
            defaultReasoningEffort: ValueFormatUtils.firstValidValue([modelInfo, metadata, litellmParams], ['default_reasoning_effort', 'defaultReasoningEffort', 'reasoning_effort', 'reasoningEffort'], liteLlmMetadataStringZodModel),
            reasoningSummary: ValueFormatUtils.firstValidValue([modelInfo, metadata, litellmParams], ['reasoning_summary', 'reasoningSummary'], liteLlmMetadataStringZodModel),
            textVerbosity: ValueFormatUtils.firstValidValue([modelInfo, metadata, litellmParams], ['text_verbosity', 'textVerbosity'], liteLlmMetadataStringZodModel),
            thinkingBudgetTokens: ValueFormatUtils.firstValidValue([modelInfo, metadata, litellmParams], ['thinking_budget_tokens', 'thinkingBudgetTokens', 'budget_tokens', 'budgetTokens'], liteLlmMetadataNumberZodModel),
        };
    }

    private readObject(value: unknown): Record<string, unknown> | undefined {
        const result = liteLlmMetadataObjectZodModel.safeParse(value);
        return result.success ? result.data : undefined;
    }
}

const liteLlmApiAdapter = new LiteLlmApiAdapter();
export default liteLlmApiAdapter;
