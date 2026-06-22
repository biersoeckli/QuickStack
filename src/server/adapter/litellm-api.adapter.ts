import { ServiceException } from "@/shared/model/service.exception.model";

type LiteLlmModelInfoResponse = {
    data?: Array<{
        model_name?: string;
    }>;
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

    async createVirtualKey(baseUrl: string, adminKey: string, modelAlias: string): Promise<string> {
        const response = await this.fetchJson<{ key?: string }>(baseUrl, adminKey, '/key/generate', {
            method: 'POST',
            body: JSON.stringify({ models: [modelAlias] }),
        });

        if (!response.key) {
            throw new ServiceException('LiteLLM virtual key response did not contain a key field.');
        }
        return response.key;
    }

    async listModelAliases(baseUrl: string, adminKey: string): Promise<string[]> {
        const response = await this.fetchJson<LiteLlmModelInfoResponse>(baseUrl, adminKey, '/model/info');
        if (!response.data || !Array.isArray(response.data)) {
            throw new ServiceException('LiteLLM returned an unexpected model info payload.');
        }

        return Array.from(new Set(response.data
            .map((item) => item.model_name?.trim())
            .filter((item): item is string => !!item)))
            .sort((a, b) => a.localeCompare(b));
    }
}

const liteLlmApiAdapter = new LiteLlmApiAdapter();
export default liteLlmApiAdapter;
