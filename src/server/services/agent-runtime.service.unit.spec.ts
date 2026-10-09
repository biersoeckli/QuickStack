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
vi.mock('@/server/adapter/agent-sandbox.adapter', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/server/adapter/agent-sandbox.adapter')>();
    return {
        default: {
            createSandboxClaim: vi.fn(),
            deleteSandboxClaim: vi.fn(),
            getSandboxClaim: vi.fn(),
            getSandbox: vi.fn(),
            listSandboxClaims: vi.fn(),
            hasActiveClaim: vi.fn(),
            waitForSandboxReady: vi.fn(),
            waitForSandboxSuspended: vi.fn(),
            setSandboxOperatingMode: vi.fn(),
            reconcileSandboxTemplate: vi.fn(),
            reconcileSandboxWarmPool: vi.fn(),
            deleteSandboxTemplate: vi.fn(),
            deleteSandboxWarmPool: vi.fn(),
            resolveSandboxStatus: actual.resolveSandboxStatus,
        },
        SANDBOX_API_GROUP: 'extensions.agents.x-k8s.io',
        SANDBOX_API_VERSION: 'v1beta1',
        resolveSandboxStatus: actual.resolveSandboxStatus,
    };
});
vi.mock('@/server/services/secret.service', () => ({
    default: {
        getDecodedSecret: vi.fn(),
        createOrReplaceGenericSecret: vi.fn(),
        deleteSecretSafe: vi.fn(),
        listDecodedSecretsByLabels: vi.fn(),
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
vi.mock('@/server/adapter/kubernetes-api.adapter', () => ({ default: {} }));

import dataAccess from '@/server/adapter/db.client';
import agentSandboxAdapter from '@/server/adapter/agent-sandbox.adapter';
import liteLlmApiAdapter from '@/server/adapter/litellm-api.adapter';
import secretService from '@/server/services/secret.service';
import agentRuntimeService from './agent-runtime.service';
import { ServiceException } from '@/shared/model/service.exception.model';

const AGENT_ID = 'agent-test-runner';
const PROJECT = { id: 'proj-1', name: 'test-project' };
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
        modelAlias: ['gpt-4o', 'claude-3-5-sonnet'],
        sourceType: 'CONTAINER',
        buildMethod: 'DOCKERFILE',
        containerImageSource: null,
        containerRegistryUsername: null,
        containerRegistryPassword: null,
        gitUrl: null,
        gitBranch: null,
        gitUsername: null,
        gitToken: null,
        dockerfilePath: './Dockerfile',
        cpuRequest: null,
        cpuLimit: null,
        memoryRequest: null,
        memoryLimit: null,
        encryptedEnvVars: JSON.stringify([
            { name: 'MY_KEY', value: 'encrypted:my-secret' },
        ]),
        agentDomains: [],
        agentVolumes: [],
        agentFileMounts: [],
        agentGitSshKey: null,
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

    describe('startSandbox', () => {
        it('starts Git source agents after the sandbox template has been deployed', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent({ sourceType: 'GIT' }) as any);
            vi.mocked(liteLlmApiAdapter.createVirtualKey).mockResolvedValue('sk-v-test-key');

            await agentRuntimeService.startSandbox(AGENT_ID, USER_ID);

            expect(agentSandboxAdapter.createSandboxClaim).toHaveBeenCalled();
        });

        it('creates virtual key restricted to agent model alias', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent() as any);
            vi.mocked(liteLlmApiAdapter.createVirtualKey).mockResolvedValue('sk-v-test-key');

            await agentRuntimeService.startSandbox(AGENT_ID, USER_ID);

            expect(liteLlmApiAdapter.createVirtualKey).toHaveBeenCalledWith(
                'https://litellm.example.com',
                'adminkey',
                ['gpt-4o', 'claude-3-5-sonnet'],
                { quickstack: { agentId: AGENT_ID, scope: 'agent' } },
            );
        });

        it('assembles Agent Runtime Secret with gateway URL, virtual key, and env vars', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent() as any);
            vi.mocked(liteLlmApiAdapter.createVirtualKey).mockResolvedValue('sk-v-test-key');

            await agentRuntimeService.startSandbox(AGENT_ID, USER_ID);

            expect(secretService.createOrReplaceGenericSecret).toHaveBeenCalledWith(
                expect.stringContaining('secret-'),
                SANDBOX_NAMESPACE,
                expect.objectContaining({
                    QS_GATEWAY_URL: 'https://litellm.example.com',
                    QS_VIRTUAL_KEY: 'sk-v-test-key',
                    MY_KEY: 'my-secret',
                }),
            );
        });

        it('resolves the harness virtual-key reference before creating the runtime secret', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent({
                encryptedEnvVars: JSON.stringify([
                    { name: 'ANTHROPIC_AUTH_TOKEN', value: 'encrypted:__quickstack_runtime_virtual_key__' },
                ]),
            }) as any);
            vi.mocked(liteLlmApiAdapter.createVirtualKey).mockResolvedValue('sk-v-test-key');

            await agentRuntimeService.startSandbox(AGENT_ID, USER_ID);

            const secretData = vi.mocked(secretService.createOrReplaceGenericSecret).mock.calls[0][2] as Record<string, string>;
            expect(secretData.ANTHROPIC_AUTH_TOKEN).toBe('sk-v-test-key');
        });

        it('omits env vars from secret when agent has none', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent({ encryptedEnvVars: null }) as any);
            vi.mocked(liteLlmApiAdapter.createVirtualKey).mockResolvedValue('sk-v-test-key');

            await agentRuntimeService.startSandbox(AGENT_ID, USER_ID);

            const callArgs = vi.mocked(secretService.createOrReplaceGenericSecret).mock.calls[0][2] as Record<string, string>;
            expect(Object.keys(callArgs)).toHaveLength(2); // QS_GATEWAY_URL + QS_VIRTUAL_KEY
        });

        it('reuses existing runtime secret without overwriting it', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent() as any);
            vi.mocked(secretService.getDecodedSecret).mockResolvedValue({
                QS_GATEWAY_URL: 'https://litellm.example.com',
                QS_VIRTUAL_KEY: 'existing-key',
            });

            await agentRuntimeService.startSandbox(AGENT_ID, USER_ID);

            expect(liteLlmApiAdapter.createVirtualKey).not.toHaveBeenCalled();
            expect(secretService.createOrReplaceGenericSecret).not.toHaveBeenCalled();
        });

        it('creates SandboxClaim targeting the agent warm pool', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent() as any);
            vi.mocked(liteLlmApiAdapter.createVirtualKey).mockResolvedValue('sk-v-test-key');

            await agentRuntimeService.startSandbox(AGENT_ID, USER_ID);

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

        it('passes per-sandbox env and idle timeout to SandboxClaim', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent() as any);
            vi.mocked(liteLlmApiAdapter.createVirtualKey).mockResolvedValue('sk-v-test-key');

            await agentRuntimeService.startSandbox(AGENT_ID, USER_ID, {
                env: { FOO: 'bar' },
                idleTimeoutMinutes: 10,
                timeoutMs: 123_000,
            });

            expect(agentSandboxAdapter.createSandboxClaim).toHaveBeenCalledWith(
                expect.objectContaining({
                    spec: expect.objectContaining({
                        warmPoolRef: { name: AGENT_ID },
                        env: [{ name: 'FOO', value: 'bar' }],
                        lifecycle: { shutdownPolicy: 'Delete', ttlSecondsAfterFinished: 600 },
                    }),
                }),
            );
            expect(agentSandboxAdapter.waitForSandboxReady).toHaveBeenCalledWith(
                expect.stringMatching(/^ac-/),
                SANDBOX_NAMESPACE,
                123_000,
            );
        });

        it('adds custom tag annotation to SandboxClaim when provided', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent() as any);
            vi.mocked(liteLlmApiAdapter.createVirtualKey).mockResolvedValue('sk-v-test-key');

            await agentRuntimeService.startSandbox(AGENT_ID, USER_ID, {
                customTag: 'feature-branch',
            });

            expect(agentSandboxAdapter.createSandboxClaim).toHaveBeenCalledWith(
                expect.objectContaining({
                    metadata: expect.objectContaining({
                        annotations: expect.objectContaining({
                            'qs-custom-tag': 'feature-branch',
                        }),
                    }),
                }),
            );
        });

        it('creates a tagged key once, stores it, and injects it into a tagged SandboxClaim', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent() as any);
            vi.mocked(liteLlmApiAdapter.createVirtualKey)
                .mockResolvedValueOnce('sk-v-agent-key')
                .mockResolvedValueOnce('sk-v-feature-key');

            await agentRuntimeService.startSandbox(AGENT_ID, USER_ID, { customTag: 'feature-branch' });

            expect(liteLlmApiAdapter.createVirtualKey).toHaveBeenLastCalledWith(
                'https://litellm.example.com',
                'adminkey',
                ['gpt-4o', 'claude-3-5-sonnet'],
                { quickstack: { agentId: AGENT_ID, customTag: 'feature-branch', scope: 'agent-sandbox' } },
            );
            expect(secretService.createOrReplaceGenericSecret).toHaveBeenLastCalledWith(
                expect.stringMatching(/^tagkey-[a-f0-9]{64}$/),
                SANDBOX_NAMESPACE,
                { QS_VIRTUAL_KEY: 'sk-v-feature-key' },
                {
                    'qs-agent-id': AGENT_ID,
                    'qs-agent-tagged-virtual-key': 'true',
                },
            );
            expect(agentSandboxAdapter.createSandboxClaim).toHaveBeenCalledWith(expect.objectContaining({
                spec: expect.objectContaining({
                    env: [{ name: 'QS_VIRTUAL_KEY', value: 'sk-v-feature-key' }],
                }),
            }));
        });

        it('reuses the tagged key from its Secret', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent() as any);
            vi.mocked(secretService.getDecodedSecret)
                .mockResolvedValueOnce({ QS_VIRTUAL_KEY: 'sk-v-agent-key' })
                .mockResolvedValueOnce({ QS_VIRTUAL_KEY: 'sk-v-feature-key' });

            await agentRuntimeService.startSandbox(AGENT_ID, USER_ID, { customTag: 'feature-branch' });

            expect(liteLlmApiAdapter.createVirtualKey).not.toHaveBeenCalled();
            expect(agentSandboxAdapter.createSandboxClaim).toHaveBeenCalledWith(expect.objectContaining({
                spec: expect.objectContaining({
                    env: [{ name: 'QS_VIRTUAL_KEY', value: 'sk-v-feature-key' }],
                }),
            }));
        });

        it('sends claim template overrides with the custom tag for PER_SANDBOX volumes', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent({
                agentVolumes: [
                    { id: 'vol-shared', agentId: AGENT_ID, containerMountPath: '/shared', size: 1024, volumeType: 'ALL', accessMode: 'ReadWriteMany', storageClassName: 'longhorn', createdAt: new Date(), updatedAt: new Date() },
                    { id: 'vol-scratch', agentId: AGENT_ID, containerMountPath: '/scratch', size: 2048, volumeType: 'PER_SANDBOX', accessMode: 'ReadWriteOnce', storageClassName: 'longhorn', createdAt: new Date(), updatedAt: new Date() },
                ],
            }) as any);
            vi.mocked(liteLlmApiAdapter.createVirtualKey).mockResolvedValue('sk-v-test-key');

            await agentRuntimeService.startSandbox(AGENT_ID, USER_ID, { customTag: 'feature-branch' });

            const claim = vi.mocked(agentSandboxAdapter.createSandboxClaim).mock.calls[0][0] as any;
            expect(claim.spec.volumeClaimTemplates).toEqual([{
                metadata: {
                    name: 'vol-scratch',
                    annotations: {
                        'qs-agent-volume-id': 'vol-scratch',
                        'qs-custom-tag': 'feature-branch',
                    },
                },
                spec: {
                    accessModes: ['ReadWriteOnce'],
                    storageClassName: 'longhorn',
                    resources: { requests: { storage: '2Gi' } },
                },
            }]);
        });

        it('sends no claim template overrides when no custom tag is provided', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent({
                agentVolumes: [
                    { id: 'vol-scratch', agentId: AGENT_ID, containerMountPath: '/scratch', size: 2048, volumeType: 'PER_SANDBOX', accessMode: 'ReadWriteOnce', storageClassName: 'longhorn', createdAt: new Date(), updatedAt: new Date() },
                ],
            }) as any);
            vi.mocked(liteLlmApiAdapter.createVirtualKey).mockResolvedValue('sk-v-test-key');

            await agentRuntimeService.startSandbox(AGENT_ID, USER_ID);

            const claim = vi.mocked(agentSandboxAdapter.createSandboxClaim).mock.calls[0][0] as any;
            expect(claim.spec.volumeClaimTemplates).toBeUndefined();
            expect(claim.metadata.annotations['qs-custom-tag']).toBeUndefined();
        });

        it('sends no claim template overrides when the agent has no PER_SANDBOX volumes', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent({
                agentVolumes: [
                    { id: 'vol-shared', agentId: AGENT_ID, containerMountPath: '/shared', size: 1024, volumeType: 'ALL', accessMode: 'ReadWriteMany', storageClassName: 'longhorn', createdAt: new Date(), updatedAt: new Date() },
                ],
            }) as any);
            vi.mocked(liteLlmApiAdapter.createVirtualKey).mockResolvedValue('sk-v-test-key');

            await agentRuntimeService.startSandbox(AGENT_ID, USER_ID, { customTag: 'feature-branch' });

            const claim = vi.mocked(agentSandboxAdapter.createSandboxClaim).mock.calls[0][0] as any;
            expect(claim.spec.volumeClaimTemplates).toBeUndefined();
            expect(claim.metadata.annotations['qs-custom-tag']).toBe('feature-branch');
        });

        it('rejects a custom tag that is empty after trimming', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent() as any);

            await expect(agentRuntimeService.startSandbox(AGENT_ID, USER_ID, { customTag: '   ' }))
                .rejects.toThrow('Custom Tag');
            expect(agentSandboxAdapter.createSandboxClaim).not.toHaveBeenCalled();
        });

        it('waits for sandbox readiness', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent() as any);
            vi.mocked(liteLlmApiAdapter.createVirtualKey).mockResolvedValue('sk-v-test-key');

            await agentRuntimeService.startSandbox(AGENT_ID, USER_ID);

            expect(agentSandboxAdapter.waitForSandboxReady).toHaveBeenCalledWith(
                expect.stringMatching(/^ac-/),
                SANDBOX_NAMESPACE,
            );
        });

        it('throws when agent not found', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(null);

            await expect(agentRuntimeService.startSandbox('nonexistent', USER_ID)).rejects.toThrow('Agent not found.');
        });

        it('throws when gateway not found on agent', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent({
                llmGateway: null,
                llmGatewayId: 'missing',
            }) as any);

            await expect(agentRuntimeService.startSandbox(AGENT_ID, USER_ID)).rejects.toThrow('LLM Gateway not found for Agent.');
        });

        it('throws when gateway admin key cannot be decrypted', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent({
                llmGateway: { ...GATEWAY, encryptedAdminKey: '' },
            }) as any);

            await expect(agentRuntimeService.startSandbox(AGENT_ID, USER_ID)).rejects.toThrow('LLM Gateway admin key is missing.');
        });

        it('throws when virtual key creation fails', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent() as any);
            vi.mocked(liteLlmApiAdapter.createVirtualKey).mockRejectedValue(
                new ServiceException('LiteLLM unreachable'),
            );

            await expect(agentRuntimeService.startSandbox(AGENT_ID, USER_ID)).rejects.toThrow('LiteLLM unreachable');
        });

        it('always creates a new virtual key on each start when no existing secret', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent() as any);
            vi.mocked(liteLlmApiAdapter.createVirtualKey).mockResolvedValue('sk-v-fresh-key');

            await agentRuntimeService.startSandbox(AGENT_ID, USER_ID);

            expect(liteLlmApiAdapter.createVirtualKey).toHaveBeenCalled();
        });
    });

    describe('stopAllSandboxes', () => {
        it('deletes all SandboxClaims for the agent', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent() as any);
            vi.mocked(agentSandboxAdapter.listSandboxClaims).mockResolvedValue([
                { metadata: { name: 'ac-agent-test-runner-aaaaaaaa' } },
            ] as any);

            await agentRuntimeService.stopAllSandboxes(AGENT_ID);

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

            await agentRuntimeService.stopAllSandboxes(AGENT_ID);

            expect(agentSandboxAdapter.deleteSandboxClaim).not.toHaveBeenCalled();
        });
    });

    describe('deleteTaggedVirtualKeys', () => {
        it('deletes each tagged key and its Secret', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent() as any);
            vi.mocked(secretService.listDecodedSecretsByLabels).mockResolvedValue([{
                name: 'tagkey-abc',
                data: { QS_VIRTUAL_KEY: 'sk-v-feature-key' },
            }]);

            await agentRuntimeService.deleteTaggedVirtualKeys(AGENT_ID);

            expect(liteLlmApiAdapter.deleteVirtualKey).toHaveBeenCalledWith(
                'https://litellm.example.com',
                'adminkey',
                'sk-v-feature-key',
            );
            expect(secretService.deleteSecretSafe).toHaveBeenCalledWith('tagkey-abc', SANDBOX_NAMESPACE);
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
            vi.mocked(agentSandboxAdapter.getSandboxClaim).mockResolvedValue(mockClaim(true) as any);

            const status = await agentRuntimeService.getAgentStatus(AGENT_ID);

            expect(status).toBe('DEPLOYED');
        });

        it('returns DEPLOYING when the claim is not ready yet', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent() as any);
            vi.mocked(agentSandboxAdapter.getSandboxClaim).mockResolvedValue({
                apiVersion: 'extensions.agents.x-k8s.io/v1beta1',
                kind: 'SandboxClaim',
                metadata: { name: AGENT_ID },
                spec: { warmPoolRef: { name: AGENT_ID } },
                status: { conditions: [{ type: 'Ready', status: 'False', message: 'Something went wrong' }] },
            } as any);

            const status = await agentRuntimeService.getAgentStatus(AGENT_ID);

            expect(status).toBe('DEPLOYING');
        });

        it('returns ERROR for a terminal SandboxClaim reconciliation failure', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent() as any);
            vi.mocked(agentSandboxAdapter.getSandboxClaim).mockResolvedValue({
                apiVersion: 'extensions.agents.x-k8s.io/v1beta1',
                kind: 'SandboxClaim',
                metadata: { name: AGENT_ID },
                spec: { warmPoolRef: { name: AGENT_ID } },
                status: { conditions: [{ type: 'Ready', status: 'False', reason: 'WarmPoolNotFound' }] },
            } as any);

            const status = await agentRuntimeService.getAgentStatus(AGENT_ID);

            expect(status).toBe('ERROR');
        });

        it('returns SHUTTING_DOWN while the claim is terminating', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent() as any);
            vi.mocked(agentSandboxAdapter.getSandboxClaim).mockResolvedValue({
                apiVersion: 'extensions.agents.x-k8s.io/v1beta1',
                kind: 'SandboxClaim',
                metadata: { name: AGENT_ID, deletionTimestamp: '2026-08-31T12:00:00Z' },
                spec: { warmPoolRef: { name: AGENT_ID } },
                status: { conditions: [{ type: 'Ready', status: 'True' }] },
            } as any);

            const status = await agentRuntimeService.getAgentStatus(AGENT_ID);

            expect(status).toBe('SHUTTING_DOWN');
        });

        it('compares status text for deployed to Running', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent() as any);
            vi.mocked(agentSandboxAdapter.getSandboxClaim).mockResolvedValue(mockClaim(true) as any);

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
            expect(agentRuntimeService.statusTextFor('BUILDING')).not.toBe('Building');
        });

        it('returns Suspended for SUSPENDED', () => {
            expect(agentRuntimeService.statusTextFor('SUSPENDED')).toBe('Suspended');
        });
    });

    describe('Custom Tag uniqueness on start', () => {
        const taggedClaim = (name: string, agentId: string, customTag: string) => ({
            apiVersion: 'extensions.agents.x-k8s.io/v1beta1',
            kind: 'SandboxClaim',
            metadata: {
                name,
                labels: { 'qs-agent-id': agentId },
                annotations: { 'qs-custom-tag': customTag },
            },
        });

        it('rejects a Custom Tag already used by another sandbox of the same Agent', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent() as any);
            vi.mocked(agentSandboxAdapter.listSandboxClaims).mockResolvedValue([
                taggedClaim('ac-other', AGENT_ID, 'taken'),
            ] as any);

            await expect(agentRuntimeService.startSandbox(AGENT_ID, USER_ID, { customTag: 'taken' }))
                .rejects.toThrow('already used');
            expect(agentSandboxAdapter.createSandboxClaim).not.toHaveBeenCalled();
        });

        it('accepts the same Custom Tag on another Agent', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent() as any);
            vi.mocked(liteLlmApiAdapter.createVirtualKey).mockResolvedValue('sk-v-test-key');
            vi.mocked(agentSandboxAdapter.listSandboxClaims).mockResolvedValue([
                taggedClaim('ac-other', 'another-agent', 'shared-tag'),
            ] as any);

            await agentRuntimeService.startSandbox(AGENT_ID, USER_ID, { customTag: 'shared-tag' });

            expect(agentSandboxAdapter.createSandboxClaim).toHaveBeenCalled();
        });

        it('leaves untagged starts unaffected', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent() as any);
            vi.mocked(liteLlmApiAdapter.createVirtualKey).mockResolvedValue('sk-v-test-key');
            vi.mocked(agentSandboxAdapter.listSandboxClaims).mockResolvedValue([
                taggedClaim('ac-other', AGENT_ID, 'taken'),
            ] as any);

            await agentRuntimeService.startSandbox(AGENT_ID, USER_ID);

            expect(agentSandboxAdapter.createSandboxClaim).toHaveBeenCalled();
        });
    });

    describe('suspendSandbox', () => {
        const runningClaim = {
            apiVersion: 'extensions.agents.x-k8s.io/v1beta1',
            kind: 'SandboxClaim',
            metadata: { name: 'ac-claim', labels: { 'qs-agent-id': AGENT_ID } },
            status: {
                sandbox: { name: 'wp-adopted' },
                conditions: [{ type: 'Ready', status: 'True' }],
            },
        } as any;
        const runningSandbox = { spec: { operatingMode: 'Running' } } as any;
        const suspendedClaim = {
            ...runningClaim,
            status: {
                sandbox: { name: 'wp-adopted' },
                conditions: [{ type: 'Ready', status: 'False', reason: 'SandboxSuspended' }],
            },
        } as any;
        const suspendedSandbox = { spec: { operatingMode: 'Suspended' } } as any;

        it('patches the Sandbox operatingMode to Suspended and keeps the claim', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent() as any);
            vi.mocked(agentSandboxAdapter.getSandboxClaim).mockResolvedValue(runningClaim);
            vi.mocked(agentSandboxAdapter.getSandbox).mockResolvedValue(runningSandbox);

            await agentRuntimeService.suspendSandbox(AGENT_ID, 'ac-claim');

            expect(agentSandboxAdapter.setSandboxOperatingMode).toHaveBeenCalledWith('wp-adopted', SANDBOX_NAMESPACE, 'Suspended');
            expect(agentSandboxAdapter.waitForSandboxSuspended).toHaveBeenCalledWith('wp-adopted', SANDBOX_NAMESPACE);
            expect(agentSandboxAdapter.deleteSandboxClaim).not.toHaveBeenCalled();
        });

        it('is a no-op when the sandbox is already suspended', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent() as any);
            vi.mocked(agentSandboxAdapter.getSandboxClaim).mockResolvedValue(suspendedClaim);
            vi.mocked(agentSandboxAdapter.getSandbox).mockResolvedValue(suspendedSandbox);

            await agentRuntimeService.suspendSandbox(AGENT_ID, 'ac-claim');

            expect(agentSandboxAdapter.setSandboxOperatingMode).not.toHaveBeenCalled();
        });

        it('rejects when the sandbox is not ready yet', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent() as any);
            vi.mocked(agentSandboxAdapter.getSandboxClaim).mockResolvedValue({
                ...runningClaim,
                status: { conditions: [{ type: 'Ready', status: 'False', reason: 'DependenciesNotReady' }] },
            } as any);
            vi.mocked(agentSandboxAdapter.getSandbox).mockResolvedValue(null);

            await expect(agentRuntimeService.suspendSandbox(AGENT_ID, 'ac-claim')).rejects.toThrow('not ready');
            expect(agentSandboxAdapter.setSandboxOperatingMode).not.toHaveBeenCalled();
        });

        it('throws not found when the claim does not exist', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent() as any);
            vi.mocked(agentSandboxAdapter.getSandboxClaim).mockResolvedValue(null);

            await expect(agentRuntimeService.suspendSandbox(AGENT_ID, 'ac-missing')).rejects.toThrow('not found');
        });
    });

    describe('resumeSandbox', () => {
        const suspendedClaim = {
            apiVersion: 'extensions.agents.x-k8s.io/v1beta1',
            kind: 'SandboxClaim',
            metadata: { name: 'ac-claim', labels: { 'qs-agent-id': AGENT_ID } },
            status: {
                sandbox: { name: 'wp-adopted' },
                conditions: [{ type: 'Ready', status: 'False', reason: 'SandboxSuspended' }],
            },
        } as any;

        it('resolves the Sandbox through the claim status and patches Running', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent() as any);
            vi.mocked(agentSandboxAdapter.getSandboxClaim).mockResolvedValue(suspendedClaim);
            vi.mocked(agentSandboxAdapter.getSandbox).mockResolvedValue({ spec: { operatingMode: 'Suspended' } } as any);

            await agentRuntimeService.resumeSandbox(AGENT_ID, 'ac-claim');

            expect(agentSandboxAdapter.setSandboxOperatingMode).toHaveBeenCalledWith('wp-adopted', SANDBOX_NAMESPACE, 'Running');
            expect(agentSandboxAdapter.waitForSandboxReady).toHaveBeenCalledWith('ac-claim', SANDBOX_NAMESPACE);
        });

        it('is a no-op when the sandbox is already running', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent() as any);
            vi.mocked(agentSandboxAdapter.getSandboxClaim).mockResolvedValue({
                ...suspendedClaim,
                status: { sandbox: { name: 'wp-adopted' }, conditions: [{ type: 'Ready', status: 'True' }] },
            } as any);
            vi.mocked(agentSandboxAdapter.getSandbox).mockResolvedValue({ spec: { operatingMode: 'Running' } } as any);

            await agentRuntimeService.resumeSandbox(AGENT_ID, 'ac-claim');

            expect(agentSandboxAdapter.setSandboxOperatingMode).not.toHaveBeenCalled();
        });

        it('throws not found when the claim does not exist', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent() as any);
            vi.mocked(agentSandboxAdapter.getSandboxClaim).mockResolvedValue(null);

            await expect(agentRuntimeService.resumeSandbox(AGENT_ID, 'ac-missing')).rejects.toThrow('not found');
        });
    });

    describe('resumeSandboxByTag', () => {
        const claim = (name: string, agentId: string, customTag: string) => ({
            apiVersion: 'extensions.agents.x-k8s.io/v1beta1',
            kind: 'SandboxClaim',
            metadata: {
                name,
                labels: { 'qs-agent-id': agentId },
                annotations: { 'qs-custom-tag': customTag },
            },
            status: { sandbox: { name: `wp-${name}` }, conditions: [{ type: 'Ready', status: 'False', reason: 'SandboxSuspended' }] },
        } as any);

        it('finds the claim with the tag annotation of this Agent only', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent() as any);
            vi.mocked(agentSandboxAdapter.listSandboxClaims).mockResolvedValue([
                claim('ac-other-agent', 'another-agent', 'session-1'),
                claim('ac-mine', AGENT_ID, 'session-1'),
            ]);
            vi.mocked(agentSandboxAdapter.getSandboxClaim).mockResolvedValue(
                claim('ac-mine', AGENT_ID, 'session-1'),
            );
            vi.mocked(agentSandboxAdapter.getSandbox).mockResolvedValue({ spec: { operatingMode: 'Suspended' } } as any);

            const result = await agentRuntimeService.resumeSandboxByTag(AGENT_ID, 'session-1');

            expect(result).toEqual({ sandboxName: 'ac-mine' });
            expect(agentSandboxAdapter.setSandboxOperatingMode).toHaveBeenCalledWith('wp-ac-mine', SANDBOX_NAMESPACE, 'Running');
        });

        it('reports not found when no sandbox of this Agent carries the tag', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(mockAgent() as any);
            vi.mocked(agentSandboxAdapter.listSandboxClaims).mockResolvedValue([
                claim('ac-other-agent', 'another-agent', 'session-1'),
            ]);

            await expect(agentRuntimeService.resumeSandboxByTag(AGENT_ID, 'session-1')).rejects.toThrow('No agent sandbox found');
        });
    });
});
