import { ServiceException } from "@/shared/model/service.exception.model";

type LiteLlmModelInfoResponse = {
    data?: Array<{
        model_name?: string;
    }>;
};

class LiteLlmApiAdapter {
    private async fetchJson<T>(baseUrl: string, adminKey: string, path: string): Promise<T> {
        let response: Response;
        try {
            response = await fetch(`${baseUrl}${path}`, {
                headers: {
                    accept: 'application/json',
                    authorization: `Bearer ${adminKey}`,
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
