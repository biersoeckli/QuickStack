vi.mock('next/cache', () => ({
    revalidateTag: vi.fn(),
    unstable_cache: (fn: unknown) => fn,
}));
vi.mock('@/server/adapter/db.client', () => ({
    default: {
        client: {
            agent: {
                findUnique: vi.fn(),
            },
            llmGateway: {
                findUnique: vi.fn(),
            },
        },
    },
}));
vi.mock('@/server/adapter/agent-sandbox.adapter', () => ({
    default: {
        createSandboxClaim: vi.fn(),
        deleteSandboxClaim: vi.fn(),
        getSandboxClaim: vi.fn(),
        hasActiveClaim: vi.fn(),
        createOrReplaceSecret: vi.fn(),
        deleteSecret: vi.fn(),
        waitForSandboxReady: vi.fn(),
        reconcileSandboxTemplate: vi.fn(),
        reconcileSandboxWarmPool: vi.fn(),
        deleteSandboxTemplate: vi.fn(),
        deleteSandboxWarmPool: vi.fn(),
    },
}));
vi.mock('@/server/adapter/litellm-api.adapter', () => ({
    default: {
        createVirtualKey: vi.fn(),
        listModelAliases: vi.fn(),
    },
}));
vi.mock('@/server/utils/crypto.utils', () => ({
    CryptoUtils: {
        encrypt: vi.fn((value: string) => `encrypted:${value}`),
        decrypt: vi.fn((value: string) => value.replace('encrypted:', '')),
    },
}));

import dataAccess from '@/server/adapter/db.client';
import agentSandboxAdapter from '@/server/adapter/agent-sandbox.adapter';
import liteLlmApiAdapter from '@/server/adapter/litellm-api.adapter';
import { CryptoUtils } from '@/server/utils/crypto.utils';
import agentRuntimeService from './agent-runtime.service';
import { ServiceException } from '@/shared/model/service.exception.model';

const AGENT_ID = 'agent-test-runner';
const PROJECT = { id: 'proj-1', name: 'test-project', projectType: 'AGENT' };
const GATEWAY = { id: 'gw-1', name: 'My Gateway', baseUrl: 'https://litellm.example.com', encryptedAdminKey: 'encrypted:adminkey' };
const SANDBOX_NAMESPACE = 'proj-1';

function mockAgent(overrides: Record<string, any> = {}) {
    return {
        id: AGENT_ID,
        name: 'Test Runner',
        projectId: PROJECT.id,
        project: PROJECT,
        llmGatewayId: GATEWAY.id,
        llmGateway: GATEWAY,
        modelAlias: 'gpt-4o',
        image: null,
        cpuRequest: null,
        cpuLimit: null,
        memoryRequest: null,
        memoryLimit: null,
        systemPrompt: 'You are helpful.',
        encryptedEnvVars: JSON.stringify([
            { name: 'MY_KEY', value: 'encrypted:my-secret' },
        ]),
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
    };
}

function mockClaim(ready: boolean, conditions?: Array<{type: string; status: string; message?: string}>) {
    return {
        metadata: { name: AGENT_ID },
        spec: { warmPoolRef: { name: AGENT_ID } },
        status: {
            conditions: conditions || (
                ready
                    ? [{ type: 'Available', status: 'True' }]
                    : [{ type: 'Available', status: 'False' }]
            ),
        },
    };
}

describe('agent-runtime.service', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    describe('startAgent', () => {
        it('creates virtual key restricted to agent model alias', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent() as any);
            vi.mocked(liteLlmApiAdapter.createVirtualKey).mockResolvedValue('sk-v-test-key');
            vi.mocked(agentSandboxAdapter.getSandboxClaim).mockResolvedValue(mockClaim(true));
            vi.mocked(agentSandboxAdapter.waitForSandboxReady).mockResolvedValue(undefined);

            await agentRuntimeService.startAgent(AGENT_ID);

            expect(liteLlmApiAdapter.createVirtualKey).toHaveBeenCalledWith(
                'https://litellm.example.com',
                'adminkey',
                'gpt-4o',
            );
        });

        it('assembles Agent Runtime Secret with gateway URL, virtual key, env vars, and system prompt', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent() as any);
            vi.mocked(liteLlmApiAdapter.createVirtualKey).mockResolvedValue('sk-v-test-key');
            vi.mocked(agentSandboxAdapter.getSandboxClaim).mockResolvedValue(mockClaim(true));
            vi.mocked(agentSandboxAdapter.waitForSandboxReady).mockResolvedValue(undefined);

            await agentRuntimeService.startAgent(AGENT_ID);

            expect(agentSandboxAdapter.createOrReplaceSecret).toHaveBeenCalledWith(
                expect.stringContaining('secret-'),
                SANDBOX_NAMESPACE,
                expect.objectContaining({
                    QS_GATEWAY_URL: 'https://litellm.example.com',
                    QS_VIRTUAL_KEY: 'sk-v-test-key',
                    MY_KEY: 'my-secret',
                    QS_SYSTEM_PROMPT: 'You are helpful.',
                }),
            );
        });

        it('omits system prompt from secret when agent has none', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent({ systemPrompt: null }) as any);
            vi.mocked(liteLlmApiAdapter.createVirtualKey).mockResolvedValue('sk-v-test-key');
            vi.mocked(agentSandboxAdapter.getSandboxClaim).mockResolvedValue(mockClaim(true));
            vi.mocked(agentSandboxAdapter.waitForSandboxReady).mockResolvedValue(undefined);

            await agentRuntimeService.startAgent(AGENT_ID);

            const callArgs = vi.mocked(agentSandboxAdapter.createOrReplaceSecret).mock.calls[0][2] as Record<string, string>;
            expect(Object.keys(callArgs)).not.toContain('QS_SYSTEM_PROMPT');
        });

        it('omits env vars from secret when agent has none', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent({ encryptedEnvVars: null, systemPrompt: null }) as any);
            vi.mocked(liteLlmApiAdapter.createVirtualKey).mockResolvedValue('sk-v-test-key');
            vi.mocked(agentSandboxAdapter.getSandboxClaim).mockResolvedValue(mockClaim(true));
            vi.mocked(agentSandboxAdapter.waitForSandboxReady).mockResolvedValue(undefined);

            await agentRuntimeService.startAgent(AGENT_ID);

            const callArgs = vi.mocked(agentSandboxAdapter.createOrReplaceSecret).mock.calls[0][2] as Record<string, string>;
            expect(Object.keys(callArgs)).toHaveLength(2); // only QS_GATEWAY_URL + QS_VIRTUAL_KEY
        });

        it('creates SandboxClaim targeting the agent warm pool', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent() as any);
            vi.mocked(liteLlmApiAdapter.createVirtualKey).mockResolvedValue('sk-v-test-key');
            vi.mocked(agentSandboxAdapter.getSandboxClaim).mockResolvedValue(mockClaim(true));
            vi.mocked(agentSandboxAdapter.waitForSandboxReady).mockResolvedValue(undefined);

            await agentRuntimeService.startAgent(AGENT_ID);

            expect(agentSandboxAdapter.createSandboxClaim).toHaveBeenCalledWith({
                name: AGENT_ID,
                namespace: SANDBOX_NAMESPACE,
                warmPoolName: AGENT_ID,
            });
        });

        it('waits for sandbox readiness', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent() as any);
            vi.mocked(liteLlmApiAdapter.createVirtualKey).mockResolvedValue('sk-v-test-key');
            vi.mocked(agentSandboxAdapter.getSandboxClaim).mockResolvedValue(mockClaim(true));
            vi.mocked(agentSandboxAdapter.waitForSandboxReady).mockResolvedValue(undefined);

            await agentRuntimeService.startAgent(AGENT_ID);

            expect(agentSandboxAdapter.waitForSandboxReady).toHaveBeenCalledWith(
                AGENT_ID,
                SANDBOX_NAMESPACE,
            );
        });

        it('throws when agent not found', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(null);

            await expect(agentRuntimeService.startAgent('nonexistent')).rejects.toThrow('Agent not found.');
        });

        it('throws when gateway not found on agent', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent({
                llmGateway: null,
                llmGatewayId: 'missing',
            }) as any);

            await expect(agentRuntimeService.startAgent(AGENT_ID)).rejects.toThrow('LLM Gateway not found for Agent.');
        });

        it('throws when gateway admin key cannot be decrypted', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent({
                llmGateway: { ...GATEWAY, encryptedAdminKey: '' },
            }) as any);

            await expect(agentRuntimeService.startAgent(AGENT_ID)).rejects.toThrow('LLM Gateway admin key is missing.');
        });

        it('throws when virtual key creation fails', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent() as any);
            vi.mocked(liteLlmApiAdapter.createVirtualKey).mockRejectedValue(
                new ServiceException('LiteLLM unreachable'),
            );

            await expect(agentRuntimeService.startAgent(AGENT_ID)).rejects.toThrow('LiteLLM unreachable');
        });

        it('always creates a new virtual key on each start', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent() as any);
            vi.mocked(liteLlmApiAdapter.createVirtualKey).mockResolvedValue('sk-v-fresh-key');
            vi.mocked(agentSandboxAdapter.getSandboxClaim).mockResolvedValue(mockClaim(true));
            vi.mocked(agentSandboxAdapter.waitForSandboxReady).mockResolvedValue(undefined);

            await agentRuntimeService.startAgent(AGENT_ID);

            expect(liteLlmApiAdapter.createVirtualKey).toHaveBeenCalled();
        });
    });

    describe('stopAgent', () => {
        it('deletes SandboxClaim', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent() as any);

            await agentRuntimeService.stopAgent(AGENT_ID);

            expect(agentSandboxAdapter.deleteSandboxClaim).toHaveBeenCalledWith(AGENT_ID, SANDBOX_NAMESPACE);
        });

        it('deletes runtime secret', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent() as any);

            await agentRuntimeService.stopAgent(AGENT_ID);

            expect(agentSandboxAdapter.deleteSecret).toHaveBeenCalledWith(
                expect.stringContaining('secret-'),
                SANDBOX_NAMESPACE,
            );
        });

        it('delegates deletion to adapters which handle 404 internally', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent() as any);

            await agentRuntimeService.stopAgent(AGENT_ID);

            expect(agentSandboxAdapter.deleteSandboxClaim).toHaveBeenCalledWith(AGENT_ID, SANDBOX_NAMESPACE);
            expect(agentSandboxAdapter.deleteSecret).toHaveBeenCalledWith(
                expect.stringContaining('secret-'),
                SANDBOX_NAMESPACE,
            );
        });
    });

    describe('getAgentStatus', () => {
        it('returns SHUTDOWN when no SandboxClaim exists', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent() as any);
            vi.mocked(agentSandboxAdapter.getSandboxClaim).mockResolvedValue(null);

            const status = await agentRuntimeService.getAgentStatus(AGENT_ID);

            expect(status).toBe('SHUTDOWN');
        });

        it('returns DEPLOYING when claim exists but not ready', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent() as any);
            vi.mocked(agentSandboxAdapter.getSandboxClaim).mockResolvedValue({
                metadata: { name: AGENT_ID },
                spec: { warmPoolRef: { name: AGENT_ID } },
                status: { conditions: [] },
            });

            const status = await agentRuntimeService.getAgentStatus(AGENT_ID);

            expect(status).toBe('DEPLOYING');
        });

        it('returns DEPLOYED when claim is ready', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent() as any);
            vi.mocked(agentSandboxAdapter.getSandboxClaim).mockResolvedValue(mockClaim(true));

            const status = await agentRuntimeService.getAgentStatus(AGENT_ID);

            expect(status).toBe('DEPLOYED');
        });

        it('compares status text for deployed to Running', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent() as any);
            vi.mocked(agentSandboxAdapter.getSandboxClaim).mockResolvedValue(mockClaim(true));

            const status = await agentRuntimeService.getAgentStatus(AGENT_ID);

            expect(agentRuntimeService.statusTextFor(status)).toBe('Running');
        });

        it('returns Running for DEPLOYED', () => {
            expect(agentRuntimeService.statusTextFor('DEPLOYED')).toBe('Running');
        });

        it('returns Shut Down for SHUTDOWN', () => {
            expect(agentRuntimeService.statusTextFor('SHUTDOWN')).toBe('Shut Down');
        });

        it('returns Deploying for DEPLOYING', () => {
            expect(agentRuntimeService.statusTextFor('DEPLOYING')).toBe('Deploying');
        });

        it('returns Error for ERROR', () => {
            expect(agentRuntimeService.statusTextFor('ERROR')).toBe('Error');
        });

        it('never returns BUILDING', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent() as any);
            vi.mocked(agentSandboxAdapter.getSandboxClaim).mockResolvedValue(mockClaim(true));

            const status = await agentRuntimeService.getAgentStatus(AGENT_ID);
            expect(status).not.toBe('BUILDING');
        });
    });
});
