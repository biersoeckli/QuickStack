import { ServiceException } from "@/shared/model/service.exception.model";
import liteLlmApiAdapter from "./litellm-api.adapter";

describe('LiteLlmApiAdapter', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('loads sorted unique model aliases', async () => {
        vi.spyOn(global, 'fetch').mockResolvedValue({
            ok: true,
            status: 200,
            json: vi.fn().mockResolvedValue({
                data: [
                    { model_name: 'gpt-4o' },
                    { model_name: 'claude-3-5-sonnet' },
                    { model_name: 'gpt-4o' },
                ],
            }),
        } as any);

        await expect(liteLlmApiAdapter.listModelAliases('https://litellm.example.com', 'secret')).resolves.toEqual([
            'claude-3-5-sonnet',
            'gpt-4o',
        ]);
    });

    it('maps auth errors to actionable messages', async () => {
        vi.spyOn(global, 'fetch').mockResolvedValue({
            ok: false,
            status: 401,
            text: vi.fn().mockResolvedValue('Unauthorized'),
        } as any);

        await expect(liteLlmApiAdapter.listModelAliases('https://litellm.example.com', 'secret')).rejects.toThrow(
            'LiteLLM authentication failed. Please check the LiteLLM Admin Key.',
        );
    });

    it('maps network failures to actionable messages', async () => {
        vi.spyOn(global, 'fetch').mockRejectedValue(new Error('connect ECONNREFUSED'));

        await expect(liteLlmApiAdapter.listModelAliases('https://litellm.example.com', 'secret')).rejects.toThrow(
            'Could not reach LiteLLM Gateway: connect ECONNREFUSED',
        );
    });

    it('rejects unexpected payloads', async () => {
        vi.spyOn(global, 'fetch').mockResolvedValue({
            ok: true,
            status: 200,
            json: vi.fn().mockResolvedValue({ models: [] }),
        } as any);

        await expect(liteLlmApiAdapter.listModelAliases('https://litellm.example.com', 'secret')).rejects.toThrow(
            ServiceException,
        );
    });
});
