import { describe, it, expect } from 'vitest';
import { agentConfigZodModel, isQuickStackReservedEnvName, QUICKSTACK_RESERVED_ENV_PREFIX } from '@/shared/model/agent-config.model';

describe('agentConfigZodModel', () => {

    describe('environment variable validation', () => {
        it('accepts valid Kubernetes env var names', () => {
            const result = agentConfigZodModel.safeParse({
                envVars: [
                    { name: 'MY_VAR', value: 'hello' },
                    { name: 'API_KEY', value: 'secret' },
                    { name: '_PREFIXED', value: 'val' },
                    { name: 'DB_HOST_1', value: 'localhost' },
                ],
            });
            expect(result.success).toBe(true);
        });

        it('rejects duplicate env var names (case-insensitive)', () => {
            const result = agentConfigZodModel.safeParse({
                envVars: [
                    { name: 'MY_VAR', value: 'hello' },
                    { name: 'my_var', value: 'world' },
                ],
            });
            expect(result.success).toBe(false);
            if (!result.success) {
                const errors = result.error.flatten().fieldErrors;
                expect(errors.envVars).toBeDefined();
            }
        });

        it('rejects QuickStack-reserved env var names', () => {
            const result = agentConfigZodModel.safeParse({
                envVars: [
                    { name: `${QUICKSTACK_RESERVED_ENV_PREFIX}GATEWAY`, value: 'test' },
                ],
            });
            expect(result.success).toBe(false);
        });

        it('rejects env var names not starting with uppercase or underscore', () => {
            const result = agentConfigZodModel.safeParse({
                envVars: [
                    { name: 'myVar', value: 'test' },
                ],
            });
            expect(result.success).toBe(false);
        });

        it('rejects env var names with lowercase letters', () => {
            const result = agentConfigZodModel.safeParse({
                envVars: [
                    { name: 'MY_var', value: 'test' },
                ],
            });
            expect(result.success).toBe(false);
        });

        it('rejects env var names longer than 63 characters', () => {
            const longName = 'A'.repeat(64);
            const result = agentConfigZodModel.safeParse({
                envVars: [
                    { name: longName, value: 'test' },
                ],
            });
            expect(result.success).toBe(false);
        });

        it('rejects empty env var names', () => {
            const result = agentConfigZodModel.safeParse({
                envVars: [
                    { name: '', value: 'test' },
                ],
            });
            expect(result.success).toBe(false);
        });

        it('rejects empty env var values', () => {
            const result = agentConfigZodModel.safeParse({
                envVars: [
                    { name: 'MY_VAR', value: '' },
                ],
            });
            expect(result.success).toBe(false);
        });

        it('accepts empty envVars array', () => {
            const result = agentConfigZodModel.safeParse({
                envVars: [],
            });
            expect(result.success).toBe(true);
        });
    });

    describe('isQuickStackReservedEnvName', () => {
        it('returns true for QS_ prefixed names (case-insensitive)', () => {
            expect(isQuickStackReservedEnvName('QS_GATEWAY')).toBe(true);
            expect(isQuickStackReservedEnvName('qs_api_key')).toBe(true);
            expect(isQuickStackReservedEnvName('QS_')).toBe(true);
        });

        it('returns false for non-QS_ prefixed names', () => {
            expect(isQuickStackReservedEnvName('MY_VAR')).toBe(false);
            expect(isQuickStackReservedEnvName('QS')).toBe(false);
            expect(isQuickStackReservedEnvName('API_KEY')).toBe(false);
        });
    });

    describe('full config parsing', () => {
        it('accepts a complete valid config', () => {
            const result = agentConfigZodModel.safeParse({
                image: 'my/image:latest',
                cpuRequest: '100m',
                cpuLimit: '500m',
                memoryRequest: '128Mi',
                memoryLimit: '512Mi',
                systemPrompt: 'You are helpful.',
                envVars: [
                    { name: 'API_KEY', value: 'secret-123' },
                    { name: 'DB_HOST', value: 'localhost' },
                ],
            });
            expect(result.success).toBe(true);
        });

        it('accepts config with all nullable fields empty', () => {
            const result = agentConfigZodModel.safeParse({});
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.envVars).toEqual([]);
                expect(result.data.warmPoolReplicas).toBe(0);
            }
        });

        it('accepts container command, args, and warm pool replicas', () => {
            const result = agentConfigZodModel.safeParse({
                containerCommand: 'sh',
                containerArgs: [{ value: '-c' }, { value: 'sleep 3600' }],
                warmPoolReplicas: '3',
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.containerCommand).toBe('sh');
                expect(result.data.containerArgs).toEqual([{ value: '-c' }, { value: 'sleep 3600' }]);
                expect(result.data.warmPoolReplicas).toBe(3);
            }
        });

        it('rejects warm pool replicas outside the allowed range', () => {
            expect(agentConfigZodModel.safeParse({ warmPoolReplicas: '-1' }).success).toBe(false);
            expect(agentConfigZodModel.safeParse({ warmPoolReplicas: '11' }).success).toBe(false);
        });
    });
});
