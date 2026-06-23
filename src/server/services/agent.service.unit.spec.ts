const dbAgentMocks = vi.hoisted(() => ({
    create: vi.fn(),
    findMany: vi.fn(),
    findFirstOrThrow: vi.fn(),
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
}));

const dbProjectMocks = vi.hoisted(() => ({
    findUnique: vi.fn(),
}));

const dbGatewayMocks = vi.hoisted(() => ({
    findUnique: vi.fn(),
}));

const sandboxMocks = vi.hoisted(() => ({
    reconcileSandboxTemplate: vi.fn(),
    reconcileSandboxWarmPool: vi.fn(),
    deleteSandboxTemplate: vi.fn(),
    deleteSandboxWarmPool: vi.fn(),
    hasActiveClaim: vi.fn(),
    getSecret: vi.fn(),
    deleteSandboxClaim: vi.fn(),
    deleteSecret: vi.fn(),
}));

const liteLlmMocks = vi.hoisted(() => ({
    createVirtualKey: vi.fn(),
    deleteVirtualKey: vi.fn(),
    listModelAliases: vi.fn(),
}));

vi.mock('next/cache', () => ({
    revalidateTag: vi.fn(),
    unstable_cache: (fn: unknown) => fn,
}));
vi.mock('@/server/adapter/db.client', () => ({
    default: {
        client: {
            agent: dbAgentMocks,
            project: dbProjectMocks,
            llmGateway: dbGatewayMocks,
            $transaction: vi.fn((fn: any) => fn({
                agent: dbAgentMocks,
                project: dbProjectMocks,
                llmGateway: dbGatewayMocks,
            })),
        },
    },
}));
vi.mock('@/server/adapter/agent-sandbox.adapter', () => ({
    default: sandboxMocks,
}));
vi.mock('@/server/adapter/litellm-api.adapter', () => ({
    default: liteLlmMocks,
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
import { ServiceException } from '@/shared/model/service.exception.model';
import agentService from './agent.service';

const DEFAULT_IMAGE = 'ghcr.io/anomalyco/opencode:latest';

function mockAgent(id: string, name: string, projectId: string = 'proj-test-agent') {
    return {
        id,
        name,
        projectId,
        llmGatewayId: 'gateway-1',
        modelAlias: 'gpt-4o',
        image: null,
        cpuRequest: null,
        cpuLimit: null,
        memoryRequest: null,
        memoryLimit: null,
        systemPrompt: null,
        encryptedEnvVars: null,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
    };
}

describe('agent.service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('create', () => {
        const validInput = {
            name: 'My Agent',
            projectId: 'proj-test-agent',
            llmGatewayId: 'gateway-1',
            modelAlias: 'gpt-4o',
        };

        it('rejects creation when project does not exist', async () => {
            vi.mocked(dataAccess.client.project.findUnique).mockResolvedValue(null);

            await expect(agentService.create(validInput)).rejects.toThrow('Project not found.');
            expect(dataAccess.client.agent.create).not.toHaveBeenCalled();
        });

        it('rejects creation when project is not AGENT type', async () => {
            vi.mocked(dataAccess.client.project.findUnique).mockResolvedValue({
                id: 'proj-app-project',
                name: 'App Project',
                projectType: 'APP',
            } as any);

            await expect(agentService.create(validInput)).rejects.toThrow(
                'Agents can only be created in Agent Projects.',
            );
            expect(dataAccess.client.agent.create).not.toHaveBeenCalled();
        });

        it('rejects creation when LLM Gateway does not exist', async () => {
            vi.mocked(dataAccess.client.project.findUnique).mockResolvedValue({
                id: 'proj-test-agent',
                name: 'Agent Project',
                projectType: 'AGENT',
            } as any);
            vi.mocked(dataAccess.client.llmGateway.findUnique).mockResolvedValue(null as any);

            await expect(agentService.create(validInput)).rejects.toThrow('LLM Gateway not found.');
            expect(dataAccess.client.agent.create).not.toHaveBeenCalled();
        });

        it('generates a stable Kubernetes-safe agent id', async () => {
            vi.mocked(dataAccess.client.project.findUnique).mockResolvedValue({
                id: 'proj-test-agent',
                name: 'Agent Project',
                projectType: 'AGENT',
            } as any);
            vi.mocked(dataAccess.client.llmGateway.findUnique).mockResolvedValue({ id: 'gateway-1' } as any);

            const agent = mockAgent('agent-my-agent', 'My Agent');
            vi.mocked(dataAccess.client.agent.create).mockResolvedValue(agent as any);

            await agentService.create(validInput);

            expect(dataAccess.client.agent.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        id: expect.stringMatching(/^agent-/),
                    }),
                }),
            );
        });

        it('persists agent with correct fields', async () => {
            vi.mocked(dataAccess.client.project.findUnique).mockResolvedValue({
                id: 'proj-test-agent',
                name: 'Agent Project',
                projectType: 'AGENT',
            } as any);
            vi.mocked(dataAccess.client.llmGateway.findUnique).mockResolvedValue({ id: 'gateway-1' } as any);

            const agent = mockAgent('agent-my-agent', 'My Agent');
            vi.mocked(dataAccess.client.agent.create).mockResolvedValue(agent as any);

            await agentService.create(validInput);

            expect(dataAccess.client.agent.create).toHaveBeenCalledWith({
                data: {
                    id: expect.stringMatching(/^agent-/),
                    name: 'My Agent',
                    projectId: 'proj-test-agent',
                    llmGatewayId: 'gateway-1',
                    modelAlias: 'gpt-4o',
                },
            });
        });

        it('reconciles SandboxTemplate with default image', async () => {
            vi.mocked(dataAccess.client.project.findUnique).mockResolvedValue({
                id: 'proj-test-agent',
                name: 'Agent Project',
                projectType: 'AGENT',
            } as any);
            vi.mocked(dataAccess.client.llmGateway.findUnique).mockResolvedValue({ id: 'gateway-1' } as any);

            const agent = mockAgent('agent-my-agent', 'My Agent');
            vi.mocked(dataAccess.client.agent.create).mockResolvedValue(agent as any);

            await agentService.create(validInput);

            expect(agentSandboxAdapter.reconcileSandboxTemplate).toHaveBeenCalledWith({
                name: expect.stringMatching(/^agent-/),
                namespace: 'proj-test-agent',
                image: DEFAULT_IMAGE,
            });
        });

        it('reconciles zero-replica SandboxWarmPool', async () => {
            vi.mocked(dataAccess.client.project.findUnique).mockResolvedValue({
                id: 'proj-test-agent',
                name: 'Agent Project',
                projectType: 'AGENT',
            } as any);
            vi.mocked(dataAccess.client.llmGateway.findUnique).mockResolvedValue({ id: 'gateway-1' } as any);

            const agent = mockAgent('agent-my-agent', 'My Agent');
            vi.mocked(dataAccess.client.agent.create).mockResolvedValue(agent as any);

            await agentService.create(validInput);

            expect(agentSandboxAdapter.reconcileSandboxWarmPool).toHaveBeenCalledWith({
                name: expect.stringMatching(/^agent-/),
                namespace: 'proj-test-agent',
                templateName: expect.stringMatching(/^agent-/),
                replicas: 0,
            });
        });

        it('rolls back DB record on K8s SandboxTemplate failure', async () => {
            vi.mocked(dataAccess.client.project.findUnique).mockResolvedValue({
                id: 'proj-test-agent',
                name: 'Agent Project',
                projectType: 'AGENT',
            } as any);
            vi.mocked(dataAccess.client.llmGateway.findUnique).mockResolvedValue({ id: 'gateway-1' } as any);

            const agent = mockAgent('agent-my-agent', 'My Agent');
            vi.mocked(dataAccess.client.agent.create).mockResolvedValue(agent as any);
            vi.mocked(agentSandboxAdapter.reconcileSandboxTemplate).mockRejectedValue(
                new Error('K8s API unreachable'),
            );

            await expect(agentService.create(validInput)).rejects.toThrow('Failed to create agent');

            expect(dataAccess.client.agent.delete).toHaveBeenCalledWith({
                where: { id: expect.stringMatching(/^agent-/) },
            });
        });

        it('rolls back DB record on K8s SandboxWarmPool failure', async () => {
            vi.mocked(dataAccess.client.project.findUnique).mockResolvedValue({
                id: 'proj-test-agent',
                name: 'Agent Project',
                projectType: 'AGENT',
            } as any);
            vi.mocked(dataAccess.client.llmGateway.findUnique).mockResolvedValue({ id: 'gateway-1' } as any);

            const agent = mockAgent('agent-my-agent', 'My Agent');
            vi.mocked(dataAccess.client.agent.create).mockResolvedValue(agent as any);
            vi.mocked(agentSandboxAdapter.reconcileSandboxWarmPool).mockRejectedValue(
                new Error('K8s API unreachable'),
            );

            await expect(agentService.create(validInput)).rejects.toThrow('Failed to create agent');

            expect(dataAccess.client.agent.delete).toHaveBeenCalledWith({
                where: { id: expect.stringMatching(/^agent-/) },
            });
        });
    });

    describe('getAllByProjectId', () => {
        it('returns agents for a project with relations', async () => {
            const agents = [mockAgent('agent-1', 'Agent One'), mockAgent('agent-2', 'Agent Two')];
            vi.mocked(dataAccess.client.agent.findMany).mockResolvedValue(agents);

            const result = await agentService.getAllByProjectId('proj-test-agent');

            expect(result).toEqual(agents);
            expect(dataAccess.client.agent.findMany).toHaveBeenCalledWith({
                where: { projectId: 'proj-test-agent' },
                include: { project: true, llmGateway: true },
                orderBy: { name: 'asc' },
            });
        });
    });

    describe('getById', () => {
        it('returns a single agent with relations', async () => {
            const agent = mockAgent('agent-1', 'Agent One');
            vi.mocked(dataAccess.client.agent.findFirstOrThrow).mockResolvedValue(agent);

            const result = await agentService.getById('agent-1');

            expect(result).toEqual(agent);
            expect(dataAccess.client.agent.findFirstOrThrow).toHaveBeenCalledWith({
                where: { id: 'agent-1' },
                include: { project: true, llmGateway: true },
            });
        });
    });

    describe('deleteById', () => {
        const gatewayInfo = {
            id: 'gateway-1',
            name: 'Test Gateway',
            baseUrl: 'https://litellm.example.com',
            encryptedAdminKey: 'encrypted:gw-key',
        };

        it('stops runtime, deletes virtual key, sandbox resources, and DB record', async () => {
            const agentMock = {
                ...mockAgent('agent-1', 'Agent One'),
                project: { id: 'proj-test-agent' },
                llmGateway: gatewayInfo,
            } as any;
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(agentMock);
            vi.mocked(dataAccess.client.agent.delete).mockResolvedValue({} as any);
            agentSandboxAdapter.getSecret.mockResolvedValue({ QS_VIRTUAL_KEY: 'sk-v-key-123' });
            liteLlmMocks.deleteVirtualKey.mockResolvedValue(undefined);

            await agentService.deleteById('agent-1');

            expect(agentSandboxAdapter.getSecret).toHaveBeenCalledWith(
                expect.stringContaining('secret-'),
                'proj-test-agent',
            );
            expect(agentSandboxAdapter.deleteSandboxClaim).toHaveBeenCalledWith('agent-1', 'proj-test-agent');
            expect(agentSandboxAdapter.deleteSecret).toHaveBeenCalledWith(
                expect.stringContaining('secret-'),
                'proj-test-agent',
            );
            expect(liteLlmApiAdapter.deleteVirtualKey).toHaveBeenCalledWith(
                'https://litellm.example.com',
                'gw-key',
                'sk-v-key-123',
            );
            expect(agentSandboxAdapter.deleteSandboxWarmPool).toHaveBeenCalledWith('agent-1', 'proj-test-agent');
            expect(agentSandboxAdapter.deleteSandboxTemplate).toHaveBeenCalledWith('agent-1', 'proj-test-agent');
            expect(dataAccess.client.agent.delete).toHaveBeenCalledWith({
                where: { id: 'agent-1' },
            });
        });

        it('returns silently when agent does not exist', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(null);

            await expect(agentService.deleteById('nonexistent')).resolves.toBeUndefined();
            expect(dataAccess.client.agent.delete).not.toHaveBeenCalled();
        });

        it('preserves DB agent when virtual key cleanup fails', async () => {
            const agentMock = {
                ...mockAgent('agent-1', 'Agent One'),
                project: { id: 'proj-test-agent' },
                llmGateway: gatewayInfo,
            } as any;
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(agentMock);
            agentSandboxAdapter.getSecret.mockResolvedValue({ QS_VIRTUAL_KEY: 'sk-v-key-123' });
            liteLlmMocks.deleteVirtualKey.mockRejectedValue(new ServiceException('LiteLLM key deletion failed'));

            await expect(agentService.deleteById('agent-1')).rejects.toThrow('LiteLLM key deletion failed');
            expect(dataAccess.client.agent.delete).not.toHaveBeenCalled();
        });

        it('deletes agent without virtual key when secret is missing', async () => {
            const agentMock = {
                ...mockAgent('agent-1', 'Agent One'),
                project: { id: 'proj-test-agent' },
                llmGateway: gatewayInfo,
            } as any;
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(agentMock);
            vi.mocked(dataAccess.client.agent.delete).mockResolvedValue({} as any);
            agentSandboxAdapter.getSecret.mockResolvedValue(null);

            await agentService.deleteById('agent-1');

            expect(liteLlmApiAdapter.deleteVirtualKey).not.toHaveBeenCalled();
            expect(dataAccess.client.agent.delete).toHaveBeenCalledWith({
                where: { id: 'agent-1' },
            });
        });

        it('handles secret read failure gracefully and still deletes', async () => {
            const agentMock = {
                ...mockAgent('agent-1', 'Agent One'),
                project: { id: 'proj-test-agent' },
                llmGateway: gatewayInfo,
            } as any;
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(agentMock);
            vi.mocked(dataAccess.client.agent.delete).mockResolvedValue({} as any);
            agentSandboxAdapter.getSecret.mockRejectedValue(new Error('K8s API unreachable'));

            await agentService.deleteById('agent-1');

            expect(liteLlmApiAdapter.deleteVirtualKey).not.toHaveBeenCalled();
            expect(dataAccess.client.agent.delete).toHaveBeenCalled();
        });
    });

    describe('saveConfig', () => {
        const agentId = 'agent-test-1';
        const namespace = 'proj-test';
        const existingAgent = {
            ...mockAgent(agentId, 'Test Agent'),
            image: null,
            cpuRequest: null,
            cpuLimit: null,
            memoryRequest: null,
            memoryLimit: null,
            systemPrompt: null,
            encryptedEnvVars: null,
            project: { name: namespace, id: 'proj-test' },
        } as any;

        beforeEach(() => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(existingAgent);
            vi.mocked(dbAgentMocks.findUniqueOrThrow).mockResolvedValue(existingAgent);
            vi.mocked(dataAccess.client.agent.update).mockResolvedValue({
                ...existingAgent,
                image: 'my-custom-image:latest',
                cpuRequest: 200,
                cpuLimit: 1000,
                memoryRequest: 256,
                memoryLimit: 1024,
            } as any);
            vi.mocked(agentSandboxAdapter.hasActiveClaim).mockResolvedValue(false);
            vi.mocked(agentSandboxAdapter.reconcileSandboxTemplate).mockResolvedValue(undefined);
            vi.mocked(agentSandboxAdapter.reconcileSandboxWarmPool).mockResolvedValue(undefined);
        });

        it('saves image, cpu, memory, and system prompt config', async () => {
            const result = await agentService.saveConfig(agentId, {
                image: 'my-custom-image:latest',
                cpuRequest: 200,
                cpuLimit: 1000,
                memoryRequest: 256,
                memoryLimit: 1024,
                systemPrompt: 'You are a helpful assistant.',
            });

            expect(dataAccess.client.agent.update).toHaveBeenCalledWith({
                where: { id: agentId },
                data: {
                    image: 'my-custom-image:latest',
                    cpuRequest: 200,
                    cpuLimit: 1000,
                    memoryRequest: 256,
                    memoryLimit: 1024,
                    systemPrompt: 'You are a helpful assistant.',
                },
            });
            expect(result.image).toBe('my-custom-image:latest');
        });

        it('clears string config when empty strings are passed', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue({
                ...existingAgent,
                image: 'old-image:latest',
                systemPrompt: 'old prompt',
            } as any);

            await agentService.saveConfig(agentId, {
                image: '',
                systemPrompt: '',
            });

            expect(dataAccess.client.agent.update).toHaveBeenCalledWith({
                where: { id: agentId },
                data: {
                    image: null,
                    systemPrompt: null,
                },
            });
        });

        it('encrypts environment variable values', async () => {
            const { CryptoUtils } = await import('@/server/utils/crypto.utils');

            await agentService.saveConfig(agentId, {
                image: undefined,
                envVars: [
                    { name: 'API_KEY', value: 'secret-123' },
                    { name: 'DB_PASSWORD', value: 'db-secret-456' },
                ],
            });

            expect(CryptoUtils.encrypt).toHaveBeenCalledWith('secret-123');
            expect(CryptoUtils.encrypt).toHaveBeenCalledWith('db-secret-456');

            const updateCall = vi.mocked(dataAccess.client.agent.update).mock.calls[0][0];
            const encryptedRaw = (updateCall as any).data.encryptedEnvVars;
            expect(encryptedRaw).toBeDefined();
            const parsed = JSON.parse(encryptedRaw);
            expect(parsed).toHaveLength(2);
            expect(parsed[0].name).toBe('API_KEY');
            expect(parsed[0].value).toBe('encrypted:secret-123');
            expect(parsed[1].name).toBe('DB_PASSWORD');
            expect(parsed[1].value).toBe('encrypted:db-secret-456');
        });

        it('rejects runtime-relevant config changes while running', async () => {
            vi.mocked(agentSandboxAdapter.hasActiveClaim).mockResolvedValue(true);

            await expect(
                agentService.saveConfig(agentId, {
                    image: 'new-image:latest',
                    cpuRequest: undefined,
                    cpuLimit: undefined,
                    memoryRequest: undefined,
                    memoryLimit: undefined,
                    systemPrompt: undefined,
                }),
            ).rejects.toThrow(
                'Runtime configuration cannot be changed while the Agent is running.',
            );
        });

        it('allows non-runtime config changes while running', async () => {
            vi.mocked(agentSandboxAdapter.hasActiveClaim).mockResolvedValue(true);

            await expect(
                agentService.saveConfig(agentId, {
                    image: undefined,
                    cpuRequest: undefined,
                    cpuLimit: undefined,
                    memoryRequest: undefined,
                    memoryLimit: undefined,
                    systemPrompt: 'new prompt',
                    envVars: [
                        { name: 'KEY', value: 'val' },
                    ],
                }),
            ).resolves.toBeDefined();
        });

        it('allows runtime config changes while stopped', async () => {
            vi.mocked(agentSandboxAdapter.hasActiveClaim).mockResolvedValue(false);

            await expect(
                agentService.saveConfig(agentId, {
                    image: 'new-image:latest',
                    cpuRequest: 100,
                    systemPrompt: undefined,
                    envVars: undefined,
                }),
            ).resolves.toBeDefined();
        });

        it('persists gateway and model alias changes', async () => {
            const agentWithOld = {
                ...existingAgent,
                llmGatewayId: 'old-gateway',
                modelAlias: 'old-model',
            } as any;
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(agentWithOld);
            vi.mocked(dbAgentMocks.findUniqueOrThrow).mockResolvedValue(agentWithOld);

            await agentService.saveConfig(agentId, {
                llmGatewayId: 'new-gateway',
                modelAlias: 'new-model',
            });

            const updateCall = vi.mocked(dataAccess.client.agent.update).mock.calls[0][0];
            expect((updateCall as any).data.llmGatewayId).toBe('new-gateway');
            expect((updateCall as any).data.modelAlias).toBe('new-model');
        });

        it('saves only provided fields', async () => {
            await agentService.saveConfig(agentId, {
                systemPrompt: 'new prompt',
            });

            const updateCall = vi.mocked(dataAccess.client.agent.update).mock.calls[0][0];
            expect(Object.keys((updateCall as any).data)).toEqual(['systemPrompt']);
        });

        it('rejects concurrent gateway change inside transaction', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue({
                ...existingAgent,
                llmGatewayId: 'old-gateway',
            } as any);
            // Simulate concurrent change: in-transaction read returns different gateway
            vi.mocked(dbAgentMocks.findUniqueOrThrow).mockResolvedValue({
                ...existingAgent,
                llmGatewayId: 'other-gateway',
            } as any);

            await expect(
                agentService.saveConfig(agentId, { llmGatewayId: 'new-gateway' }),
            ).rejects.toThrow('Agent configuration was modified by another process.');
        });

        it('does not send encryptedEnvVars when envVars is undefined', async () => {
            await agentService.saveConfig(agentId, {
                image: undefined,
                cpuRequest: undefined,
                systemPrompt: undefined,
                envVars: undefined,
            });

            const updateCall = vi.mocked(dataAccess.client.agent.update).mock.calls[0][0];
            expect((updateCall as any).data.encryptedEnvVars).toBeUndefined();
        });

        it('throws when agent does not exist', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(null);

            await expect(
                agentService.saveConfig('nonexistent', {}),
            ).rejects.toThrow('Agent not found.');
        });
    });
});
