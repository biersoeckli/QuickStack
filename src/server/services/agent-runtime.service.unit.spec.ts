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
            user: {
                findFirst: vi.fn(),
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
        listSandboxClaims: vi.fn(),
        hasActiveClaim: vi.fn(),
        waitForSandboxReady: vi.fn(),
        reconcileSandboxTemplate: vi.fn(),
        reconcileSandboxWarmPool: vi.fn(),
        deleteSandboxTemplate: vi.fn(),
        deleteSandboxWarmPool: vi.fn(),
    },
    SANDBOX_API_GROUP: 'extensions.agents.x-k8s.io',
    SANDBOX_API_VERSION: 'v1beta1',
}));
vi.mock('@/server/services/secret.service', () => ({
    default: {
        getDecodedSecret: vi.fn(),
        createOrReplaceGenericSecret: vi.fn(),
        deleteSecretSafe: vi.fn(),
    },
}));
vi.mock('@/server/services/pvc.service', () => ({
    default: {
        ensurePvcForUserAgent: vi.fn(),
        ensureWorkspacePvcForUserAgent: vi.fn(),
        deleteAllPvcForAgent: vi.fn(),
        deleteUnusedPvcForAgent: vi.fn(),
    },
}));
vi.mock('@/server/adapter/litellm-api.adapter', () => ({
    default: {
        createVirtualKey: vi.fn(),
        deleteVirtualKey: vi.fn(),
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
import secretService from '@/server/services/secret.service';
import { CryptoUtils } from '@/server/utils/crypto.utils';
import agentRuntimeService from './agent-runtime.service';
import { ServiceException } from '@/shared/model/service.exception.model';

const AGENT_ID = 'agent-test-runner';
const PROJECT = { id: 'proj-1', name: 'test-project', projectType: 'AGENT' };
const GATEWAY = { id: 'gw-1', name: 'My Gateway', baseUrl: 'https://litellm.example.com', encryptedAdminKey: 'encrypted:adminkey' };
const SANDBOX_NAMESPACE = 'proj-1';
const USER_ID = 'user-123';

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
        agentDomains: [],
        agentVolumes: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
    };
}

function mockClaim(ready: boolean, conditions?: Array<{ type: string; status: string; message?: string }>) {
    return {
        apiVersion: 'extensions.agents.x-k8s.io/v1beta1',
        kind: 'SandboxClaim',
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
        vi.mocked(secretService.getDecodedSecret).mockResolvedValue(null);
        vi.mocked(agentSandboxAdapter.listSandboxClaims).mockResolvedValue([] as any);
        vi.mocked(agentSandboxAdapter.waitForSandboxReady).mockResolvedValue(undefined);
    });

    describe('startInstance', () => {
        it('creates virtual key restricted to agent model alias', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent() as any);
            vi.mocked(liteLlmApiAdapter.createVirtualKey).mockResolvedValue('sk-v-test-key');

            await agentRuntimeService.startInstance(AGENT_ID, USER_ID);

            expect(liteLlmApiAdapter.createVirtualKey).toHaveBeenCalledWith(
                'https://litellm.example.com',
                'adminkey',
                'gpt-4o',
            );
        });

        it('assembles Agent Runtime Secret with gateway URL, virtual key, env vars, and system prompt', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent() as any);
            vi.mocked(liteLlmApiAdapter.createVirtualKey).mockResolvedValue('sk-v-test-key');

            await agentRuntimeService.startInstance(AGENT_ID, USER_ID);

            expect(secretService.createOrReplaceGenericSecret).toHaveBeenCalledWith(
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

            await agentRuntimeService.startInstance(AGENT_ID, USER_ID);

            const callArgs = vi.mocked(secretService.createOrReplaceGenericSecret).mock.calls[0][2] as Record<string, string>;
            expect(Object.keys(callArgs)).not.toContain('QS_SYSTEM_PROMPT');
        });

        it('omits env vars from secret when agent has none', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent({ encryptedEnvVars: null, systemPrompt: null }) as any);
            vi.mocked(liteLlmApiAdapter.createVirtualKey).mockResolvedValue('sk-v-test-key');

            await agentRuntimeService.startInstance(AGENT_ID, USER_ID);

            const callArgs = vi.mocked(secretService.createOrReplaceGenericSecret).mock.calls[0][2] as Record<string, string>;
            expect(Object.keys(callArgs)).toHaveLength(2); // QS_GATEWAY_URL + QS_VIRTUAL_KEY
        });

        it('reuses existing runtime secret without overwriting it', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent() as any);
            vi.mocked(secretService.getDecodedSecret).mockResolvedValue({
                QS_GATEWAY_URL: 'https://litellm.example.com',
                QS_VIRTUAL_KEY: 'existing-key',
            });

            await agentRuntimeService.startInstance(AGENT_ID, USER_ID);

            expect(liteLlmApiAdapter.createVirtualKey).not.toHaveBeenCalled();
            expect(secretService.createOrReplaceGenericSecret).not.toHaveBeenCalled();
        });

        it('creates SandboxClaim targeting the agent warm pool', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent() as any);
            vi.mocked(liteLlmApiAdapter.createVirtualKey).mockResolvedValue('sk-v-test-key');

            await agentRuntimeService.startInstance(AGENT_ID, USER_ID);

            expect(agentSandboxAdapter.createSandboxClaim).toHaveBeenCalledWith(
                expect.objectContaining({
                    apiVersion: 'extensions.agents.x-k8s.io/v1beta1',
                    kind: 'SandboxClaim',
                    metadata: expect.objectContaining({
                        name: expect.stringMatching(/^ac-/),
                        namespace: SANDBOX_NAMESPACE,
                        labels: expect.objectContaining({
                            'qs-agent-id': AGENT_ID,
                            'qs-project-id': SANDBOX_NAMESPACE,
                            'qs-user-id': USER_ID,
                        }),
                    }),
                    spec: expect.objectContaining({
                        warmPoolRef: { name: AGENT_ID },
                    }),
                }),
            );
        });

        it('waits for sandbox readiness', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent() as any);
            vi.mocked(liteLlmApiAdapter.createVirtualKey).mockResolvedValue('sk-v-test-key');

            await agentRuntimeService.startInstance(AGENT_ID, USER_ID);

            expect(agentSandboxAdapter.waitForSandboxReady).toHaveBeenCalledWith(
                expect.stringMatching(/^ac-/),
                SANDBOX_NAMESPACE,
            );
        });

        it('throws when agent not found', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(null);

            await expect(agentRuntimeService.startInstance('nonexistent', USER_ID)).rejects.toThrow('Agent not found.');
        });

        it('throws when gateway not found on agent', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent({
                llmGateway: null,
                llmGatewayId: 'missing',
            }) as any);

            await expect(agentRuntimeService.startInstance(AGENT_ID, USER_ID)).rejects.toThrow('LLM Gateway not found for Agent.');
        });

        it('throws when gateway admin key cannot be decrypted', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent({
                llmGateway: { ...GATEWAY, encryptedAdminKey: '' },
            }) as any);

            await expect(agentRuntimeService.startInstance(AGENT_ID, USER_ID)).rejects.toThrow('LLM Gateway admin key is missing.');
        });

        it('throws when virtual key creation fails', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent() as any);
            vi.mocked(liteLlmApiAdapter.createVirtualKey).mockRejectedValue(
                new ServiceException('LiteLLM unreachable'),
            );

            await expect(agentRuntimeService.startInstance(AGENT_ID, USER_ID)).rejects.toThrow('LiteLLM unreachable');
        });

        it('always creates a new virtual key on each start when no existing secret', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent() as any);
            vi.mocked(liteLlmApiAdapter.createVirtualKey).mockResolvedValue('sk-v-fresh-key');

            await agentRuntimeService.startInstance(AGENT_ID, USER_ID);

            expect(liteLlmApiAdapter.createVirtualKey).toHaveBeenCalled();
        });
    });

    describe('stopAllInstances', () => {
        it('deletes all SandboxClaims for the agent', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent() as any);
            vi.mocked(agentSandboxAdapter.listSandboxClaims).mockResolvedValue([
                { metadata: { name: 'ac-agent-test-runner-aaaaaaaa' } },
            ] as any);

            await agentRuntimeService.stopAllInstances(AGENT_ID);

            expect(agentSandboxAdapter.listSandboxClaims).toHaveBeenCalledWith(
                SANDBOX_NAMESPACE,
                'qs-agent-id=agent-test-runner',
            );
            expect(agentSandboxAdapter.deleteSandboxClaim).toHaveBeenCalledWith(
                'ac-agent-test-runner-aaaaaaaa',
                SANDBOX_NAMESPACE,
            );
        });

        it('handles no claims gracefully', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent() as any);
            vi.mocked(agentSandboxAdapter.listSandboxClaims).mockResolvedValue([]);

            await agentRuntimeService.stopAllInstances(AGENT_ID);

            expect(agentSandboxAdapter.deleteSandboxClaim).not.toHaveBeenCalled();
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
                apiVersion: 'extensions.agents.x-k8s.io/v1beta1',
                kind: 'SandboxClaim',
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

        it('returns ERROR when claim has failed condition', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent() as any);
            vi.mocked(agentSandboxAdapter.getSandboxClaim).mockResolvedValue({
                apiVersion: 'extensions.agents.x-k8s.io/v1beta1',
                kind: 'SandboxClaim',
                metadata: { name: AGENT_ID },
                spec: { warmPoolRef: { name: AGENT_ID } },
                status: { conditions: [{ type: 'Ready', status: 'False', message: 'Something went wrong' }] },
            });

            const status = await agentRuntimeService.getAgentStatus(AGENT_ID);

            expect(status).toBe('ERROR');
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

        it('never returns BUILDING', () => {
            // @ts-expect-error - testing invalid status
            expect(agentRuntimeService.statusTextFor('BUILDING')).not.toBe('Building');
        });
    });
});
