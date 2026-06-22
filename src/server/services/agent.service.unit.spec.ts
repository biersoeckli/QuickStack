vi.mock('next/cache', () => ({
    revalidateTag: vi.fn(),
    unstable_cache: (fn: unknown) => fn,
}));
vi.mock('@/server/adapter/db.client', () => ({
    default: {
        client: {
            agent: {
                create: vi.fn(),
                findMany: vi.fn(),
                findFirstOrThrow: vi.fn(),
                findUnique: vi.fn(),
                delete: vi.fn(),
                update: vi.fn(),
            },
            project: {
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
        reconcileSandboxTemplate: vi.fn(),
        reconcileSandboxWarmPool: vi.fn(),
        deleteSandboxTemplate: vi.fn(),
        deleteSandboxWarmPool: vi.fn(),
        hasActiveClaim: vi.fn(),
    },
}));
vi.mock('@/server/utils/crypto.utils', () => ({
    CryptoUtils: {
        encrypt: vi.fn((value: string) => `encrypted:${value}`),
        decrypt: vi.fn(),
    },
}));

import dataAccess from '@/server/adapter/db.client';
import agentSandboxAdapter from '@/server/adapter/agent-sandbox.adapter';
import agentService from './agent.service';

const DEFAULT_IMAGE = 'ghcr.io/quickstack-dev/agent-sandbox:latest';

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
                namespace: 'Agent Project',
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
                namespace: 'Agent Project',
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
        it('deletes sandbox resources then DB record', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue({
                ...mockAgent('agent-1', 'Agent One'),
                project: { name: 'Agent Project' },
            } as any);

            await agentService.deleteById('agent-1');

            expect(agentSandboxAdapter.deleteSandboxWarmPool).toHaveBeenCalledWith(
                'agent-1',
                'Agent Project',
            );
            expect(agentSandboxAdapter.deleteSandboxTemplate).toHaveBeenCalledWith(
                'agent-1',
                'Agent Project',
            );
            expect(dataAccess.client.agent.delete).toHaveBeenCalledWith({
                where: { id: 'agent-1' },
            });
        });

        it('returns silently when agent does not exist', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(null);

            await expect(agentService.deleteById('nonexistent')).resolves.toBeUndefined();
            expect(dataAccess.client.agent.delete).not.toHaveBeenCalled();
        });
    });

    describe('saveConfig', () => {
        const agentId = 'agent-test-1';
        const namespace = 'Agent Project';
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
            vi.mocked(dataAccess.client.agent.update).mockResolvedValue({
                ...existingAgent,
                image: 'my-custom-image:latest',
                cpuRequest: '200m',
                cpuLimit: '1',
                memoryRequest: '256Mi',
                memoryLimit: '1Gi',
            } as any);
            vi.mocked(agentSandboxAdapter.hasActiveClaim).mockResolvedValue(false);
            vi.mocked(agentSandboxAdapter.reconcileSandboxTemplate).mockResolvedValue(undefined);
            vi.mocked(agentSandboxAdapter.reconcileSandboxWarmPool).mockResolvedValue(undefined);
        });

        it('saves image, cpu, memory, and system prompt config', async () => {
            const result = await agentService.saveConfig(agentId, {
                image: 'my-custom-image:latest',
                cpuRequest: '200m',
                cpuLimit: '1',
                memoryRequest: '256Mi',
                memoryLimit: '1Gi',
                systemPrompt: 'You are a helpful assistant.',
            });

            expect(dataAccess.client.agent.update).toHaveBeenCalledWith({
                where: { id: agentId },
                data: {
                    image: 'my-custom-image:latest',
                    cpuRequest: '200m',
                    cpuLimit: '1',
                    memoryRequest: '256Mi',
                    memoryLimit: '1Gi',
                    systemPrompt: 'You are a helpful assistant.',
                },
            });
            expect(result.image).toBe('my-custom-image:latest');
        });

        it('clears resource config when empty strings are passed', async () => {
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue({
                ...existingAgent,
                image: 'old-image:latest',
                cpuRequest: '500m',
                cpuLimit: '2',
                memoryRequest: '512Mi',
                memoryLimit: '2Gi',
            } as any);

            await agentService.saveConfig(agentId, {
                image: '',
                cpuRequest: '',
                cpuLimit: '',
                memoryRequest: '',
                memoryLimit: '',
                systemPrompt: '',
            });

            expect(dataAccess.client.agent.update).toHaveBeenCalledWith({
                where: { id: agentId },
                data: {
                    image: null,
                    cpuRequest: null,
                    cpuLimit: null,
                    memoryRequest: null,
                    memoryLimit: null,
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
                    cpuRequest: '100m',
                    systemPrompt: undefined,
                    envVars: undefined,
                }),
            ).resolves.toBeDefined();
        });

        it('reconciles SandboxTemplate with saved config', async () => {
            vi.mocked(dataAccess.client.agent.update).mockResolvedValue({
                ...existingAgent,
                image: 'custom-image:v2',
                cpuRequest: '100m',
                cpuLimit: '2',
                memoryRequest: '256Mi',
                memoryLimit: '1Gi',
            } as any);

            await agentService.saveConfig(agentId, {
                image: 'custom-image:v2',
                cpuRequest: '100m',
                cpuLimit: '2',
                memoryRequest: '256Mi',
                memoryLimit: '1Gi',
                systemPrompt: undefined,
                envVars: undefined,
            });

            expect(agentSandboxAdapter.reconcileSandboxTemplate).toHaveBeenCalledWith({
                name: agentId,
                namespace,
                image: 'custom-image:v2',
                cpuRequest: '100m',
                cpuLimit: '2',
                memoryRequest: '256Mi',
                memoryLimit: '1Gi',
            });
        });

        it('reconciles SandboxTemplate with default image when none set', async () => {
            vi.mocked(dataAccess.client.agent.update).mockResolvedValue({
                ...existingAgent,
                image: null,
            } as any);

            await agentService.saveConfig(agentId, {
                image: undefined,
                cpuRequest: undefined,
                systemPrompt: undefined,
                envVars: undefined,
            });

            expect(agentSandboxAdapter.reconcileSandboxTemplate).toHaveBeenCalledWith(
                expect.objectContaining({
                    image: 'ghcr.io/quickstack-dev/agent-sandbox:latest',
                }),
            );
        });

        it('reconciles zero-replica SandboxWarmPool on save', async () => {
            await agentService.saveConfig(agentId, {
                image: undefined,
                cpuRequest: undefined,
                systemPrompt: undefined,
                envVars: undefined,
            });

            expect(agentSandboxAdapter.reconcileSandboxWarmPool).toHaveBeenCalledWith({
                name: agentId,
                namespace,
                templateName: agentId,
                replicas: 0,
            });
        });

        it('throws on K8s reconciliation failure', async () => {
            vi.mocked(agentSandboxAdapter.reconcileSandboxTemplate).mockRejectedValue(
                new Error('K8s unreachable'),
            );

            await expect(
                agentService.saveConfig(agentId, {
                    image: undefined,
                    cpuRequest: undefined,
                    systemPrompt: undefined,
                    envVars: undefined,
                }),
            ).rejects.toThrow('Failed to reconcile sandbox resources');
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
