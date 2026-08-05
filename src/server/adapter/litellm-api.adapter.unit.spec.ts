import { ServiceException } from "@/shared/model/service.exception.model";
import liteLlmApiAdapter from "./litellm-api.adapter";

describe('LiteLlmApiAdapter', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    describe('listModelAliases', () => {
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

    describe('listModelInfo', () => {
        it('maps LiteLLM metadata for OpenCode config generation', async () => {
            vi.spyOn(global, 'fetch').mockResolvedValue({
                ok: true,
                status: 200,
                json: vi.fn().mockResolvedValue({
                    data: [{
                        model_name: 'gpt-5',
                        model_info: {
                            display_name: 'GPT 5',
                            max_input_tokens: 128000,
                            max_output_tokens: '8192',
                            supports_reasoning: true,
                            default_reasoning_effort: 'medium',
                            reasoning_summary: 'auto',
                            text_verbosity: 'low',
                        },
                    }, {
                        model_name: 'claude-sonnet',
                        model_info: {
                            metadata: {
                                max_context_tokens: 200000,
                                output_token_limit: 16000,
                                thinking_budget_tokens: 4096,
                            },
                        },
                    }, {
                        model_name: '',
                        model_info: { max_input_tokens: 1 },
                    }],
                }),
            } as any);

            await expect(liteLlmApiAdapter.listModelInfo('https://litellm.example.com', 'secret')).resolves.toEqual([
                {
                    modelName: 'claude-sonnet',
                    contextLimit: 200000,
                    outputLimit: 16000,
                    thinkingBudgetTokens: 4096,
                },
                {
                    modelName: 'gpt-5',
                    displayName: 'GPT 5',
                    contextLimit: 128000,
                    outputLimit: 8192,
                    supportsReasoning: true,
                    defaultReasoningEffort: 'medium',
                    reasoningSummary: 'auto',
                    textVerbosity: 'low',
                },
            ]);
        });

        it('tolerates missing model info fields', async () => {
            vi.spyOn(global, 'fetch').mockResolvedValue({
                ok: true,
                status: 200,
                json: vi.fn().mockResolvedValue({ data: [{ model_name: 'gpt-4o' }] }),
            } as any);

            await expect(liteLlmApiAdapter.listModelInfo('https://litellm.example.com', 'secret')).resolves.toEqual([
                { modelName: 'gpt-4o' },
            ]);
        });
    });

    describe('createVirtualKey', () => {
        it('creates a virtual key restricted to the given model alias', async () => {
            let capturedBody: string | null = null;
            vi.spyOn(global, 'fetch').mockImplementation(async (_url: any, init?: any) => {
                capturedBody = init?.body ?? null;
                return {
                    ok: true,
                    status: 200,
                    json: vi.fn().mockResolvedValue({ key: 'sk-v-test-key-123' }),
                } as any;
            });

            const result = await liteLlmApiAdapter.createVirtualKey(
                'https://litellm.example.com',
                'admin-secret',
                ['gpt-4o', 'claude-3-5-sonnet'],
            );

            expect(result).toBe('sk-v-test-key-123');
            const parsed = JSON.parse(capturedBody!);
            expect(parsed.models).toEqual(['gpt-4o', 'claude-3-5-sonnet']);
            expect(parsed.max_budget).toBeUndefined();
            expect(parsed.duration).toBeUndefined();
        });

        it('sends the correct endpoint and auth headers', async () => {
            let capturedUrl: string | null = null;
            let capturedHeaders: Record<string, string> | null = null;
            vi.spyOn(global, 'fetch').mockImplementation(async (url: any, init?: any) => {
                capturedUrl = url as string;
                capturedHeaders = init?.headers ?? null;
                return {
                    ok: true,
                    status: 200,
                    json: vi.fn().mockResolvedValue({ key: 'sk-v-test-key' }),
                } as any;
            });

            await liteLlmApiAdapter.createVirtualKey(
                'https://litellm.example.com',
                'admin-secret',
                ['gpt-4o'],
            );

            expect(capturedUrl).toBe('https://litellm.example.com/key/generate');
            expect(capturedHeaders).toEqual(
                expect.objectContaining({
                    authorization: 'Bearer admin-secret',
                }),
            );
        });

        it('maps non-200 status to ServiceException', async () => {
            vi.spyOn(global, 'fetch').mockResolvedValue({
                ok: false,
                status: 500,
                text: vi.fn().mockResolvedValue('Internal Server Error'),
            } as any);

            await expect(
                liteLlmApiAdapter.createVirtualKey('https://litellm.example.com', 'admin', ['gpt-4o']),
            ).rejects.toThrow('LiteLLM request failed with status 500: Internal Server Error');
        });

        it('maps auth failures to actionable message', async () => {
            vi.spyOn(global, 'fetch').mockResolvedValue({
                ok: false,
                status: 403,
                text: vi.fn().mockResolvedValue('Forbidden'),
            } as any);

            await expect(
                liteLlmApiAdapter.createVirtualKey('https://litellm.example.com', 'admin', ['gpt-4o']),
            ).rejects.toThrow('LiteLLM authentication failed. Please check the LiteLLM Admin Key.');
        });

        it('rejects response missing the key field', async () => {
            vi.spyOn(global, 'fetch').mockResolvedValue({
                ok: true,
                status: 200,
                json: vi.fn().mockResolvedValue({ token: 'abc' }),
            } as any);

            await expect(
                liteLlmApiAdapter.createVirtualKey('https://litellm.example.com', 'admin', ['gpt-4o']),
            ).rejects.toThrow('LiteLLM virtual key response did not contain a key field.');
        });
    });

    describe('deleteVirtualKey', () => {
        it('sends DELETE request with the key in body', async () => {
            let capturedUrl: string | null = null;
            let capturedBody: string | null = null;
            vi.spyOn(global, 'fetch').mockImplementation(async (url: any, init?: any) => {
                capturedUrl = url as string;
                capturedBody = init?.body ?? null;
                return {
                    ok: true,
                    status: 200,
                    json: vi.fn().mockResolvedValue({}),
                } as any;
            });

            await liteLlmApiAdapter.deleteVirtualKey(
                'https://litellm.example.com',
                'admin-secret',
                'sk-v-key-to-delete',
            );

            expect(capturedUrl).toBe('https://litellm.example.com/key/delete');
            const parsed = JSON.parse(capturedBody!);
            expect(parsed.keys).toEqual(['sk-v-key-to-delete']);
        });

        it('maps non-200 status to ServiceException', async () => {
            vi.spyOn(global, 'fetch').mockResolvedValue({
                ok: false,
                status: 500,
                text: vi.fn().mockResolvedValue('Internal Server Error'),
            } as any);

            await expect(
                liteLlmApiAdapter.deleteVirtualKey('https://litellm.example.com', 'admin', 'sk-v-key'),
            ).rejects.toThrow('LiteLLM request failed with status 500: Internal Server Error');
        });

        it('maps auth failures to actionable message', async () => {
            vi.spyOn(global, 'fetch').mockResolvedValue({
                ok: false,
                status: 403,
                text: vi.fn().mockResolvedValue('Forbidden'),
            } as any);

            await expect(
                liteLlmApiAdapter.deleteVirtualKey('https://litellm.example.com', 'admin', 'sk-v-key'),
            ).rejects.toThrow('LiteLLM authentication failed. Please check the LiteLLM Admin Key.');
        });

        it('maps network failures to actionable messages', async () => {
            vi.spyOn(global, 'fetch').mockRejectedValue(new Error('connect ECONNREFUSED'));

            await expect(
                liteLlmApiAdapter.deleteVirtualKey('https://litellm.example.com', 'admin', 'sk-v-key'),
            ).rejects.toThrow('Could not reach LiteLLM Gateway: connect ECONNREFUSED');
        });
    });
});
