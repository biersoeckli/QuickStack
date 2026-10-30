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
                            supports_reasoning: 'TRUE',
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

        it('assigns an existing user and team to the virtual key', async () => {
            let capturedBody: string | null = null;
            vi.spyOn(global, 'fetch').mockImplementation(async (_url: any, init?: any) => {
                capturedBody = init?.body ?? null;
                return { ok: true, status: 200, json: vi.fn().mockResolvedValue({ key: 'sk-v-test-key' }) } as any;
            });

            await liteLlmApiAdapter.createVirtualKey('https://litellm.example.com', 'admin-secret', ['gpt-4o'], undefined, 'tag-1', 'team-1');

            expect(JSON.parse(capturedBody!)).toMatchObject({ user_id: 'tag-1', team_id: 'team-1' });
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

    describe('deleteVirtualKeys', () => {
        it('deletes multiple keys in one request', async () => {
            let capturedBody: string | null = null;
            vi.spyOn(global, 'fetch').mockImplementation(async (_url: any, init?: any) => {
                capturedBody = init?.body ?? null;
                return { ok: true, status: 200, json: vi.fn().mockResolvedValue({}) } as any;
            });

            await liteLlmApiAdapter.deleteVirtualKeys(
                'https://litellm.example.com',
                'admin-secret',
                ['hash-1', 'hash-2'],
            );

            expect(JSON.parse(capturedBody!)).toEqual({ keys: ['hash-1', 'hash-2'] });
        });

        it('does nothing for an empty key list', async () => {
            const fetchSpy = vi.spyOn(global, 'fetch');

            await liteLlmApiAdapter.deleteVirtualKeys('https://litellm.example.com', 'admin-secret', []);

            expect(fetchSpy).not.toHaveBeenCalled();
        });
    });

    describe('listVirtualKeysByUserId', () => {
        it('loads full key objects for a user across all pages', async () => {
            const capturedUrls: string[] = [];
            vi.spyOn(global, 'fetch').mockImplementation(async (url: any) => {
                capturedUrls.push(url as string);
                const page = new URL(url as string).searchParams.get('page');
                return {
                    ok: true,
                    status: 200,
                    json: vi.fn().mockResolvedValue(page === '1' ? {
                        keys: [{
                            token: 'hash-1',
                            user_id: 'feature-branch',
                            metadata: { quickstack: { agentId: 'agent-1', customTag: 'feature-branch', scope: 'agent-sandbox' } },
                        }],
                        total_pages: 2,
                        current_page: 1,
                    } : {
                        keys: [{
                            token: 'hash-2',
                            user_id: 'feature-branch',
                            metadata: { quickstack: { agentId: 'agent-1', customTag: 'feature-branch', scope: 'agent-sandbox' } },
                        }],
                        total_pages: 2,
                        current_page: 2,
                    }),
                } as any;
            });

            const keys = await liteLlmApiAdapter.listVirtualKeysByUserId(
                'https://litellm.example.com',
                'admin-secret',
                'feature-branch',
            );

            expect(keys.map((key) => key.token)).toEqual(['hash-1', 'hash-2']);
            expect(capturedUrls).toHaveLength(2);
            expect(capturedUrls[0]).toContain('user_id=feature-branch');
            expect(capturedUrls[0]).toContain('return_full_object=true');
            expect(capturedUrls[0]).toContain('size=100');
            expect(capturedUrls[1]).toContain('page=2');
        });

        it('ignores string entries in the key list', async () => {
            vi.spyOn(global, 'fetch').mockResolvedValue({
                ok: true,
                status: 200,
                json: vi.fn().mockResolvedValue({
                    keys: ['sk-some-key', { token: 'hash-1', metadata: {} }],
                    total_pages: 1,
                }),
            } as any);

            const keys = await liteLlmApiAdapter.listVirtualKeysByUserId(
                'https://litellm.example.com',
                'admin-secret',
                'feature-branch',
            );

            expect(keys).toHaveLength(1);
            expect(keys[0].token).toBe('hash-1');
        });
    });

    describe('users', () => {
        it('loads a user by its id', async () => {
            let capturedUrl: string | null = null;
            vi.spyOn(global, 'fetch').mockImplementation(async (url: any) => {
                capturedUrl = url as string;
                return {
                    ok: true,
                    status: 200,
                    json: vi.fn().mockResolvedValue({
                        user_id: 'user@example.com',
                        user_info: { user_email: 'user@example.com' },
                        keys: [],
                        teams: [],
                    }),
                } as any;
            });

            await expect(liteLlmApiAdapter.getUserById(
                'https://litellm.example.com',
                'admin-secret',
                'user@example.com',
            )).resolves.toMatchObject({ user_id: 'user@example.com' });

            expect(capturedUrl).toBe('https://litellm.example.com/user/info?user_id=user%40example.com');
        });

        it('creates a user with the supplied id without creating an API key', async () => {
            let capturedBody: string | null = null;
            vi.spyOn(global, 'fetch').mockImplementation(async (_url: any, init?: any) => {
                capturedBody = init?.body ?? null;
                return {
                    ok: true,
                    status: 200,
                    json: vi.fn().mockResolvedValue({ user_id: 'user-123' }),
                } as any;
            });

            await expect(liteLlmApiAdapter.createUserWithId(
                'https://litellm.example.com',
                'admin-secret',
                'user-123',
            )).resolves.toMatchObject({ user_id: 'user-123' });

            expect(JSON.parse(capturedBody!)).toEqual({
                user_id: 'user-123',
                auto_create_key: false,
            });
        });
    });
});
