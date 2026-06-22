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
            });

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
            });
            vi.mocked(dataAccess.client.llmGateway.findUnique).mockResolvedValue(null);

            await expect(agentService.create(validInput)).rejects.toThrow('LLM Gateway not found.');
            expect(dataAccess.client.agent.create).not.toHaveBeenCalled();
        });

        it('generates a stable Kubernetes-safe agent id', async () => {
            vi.mocked(dataAccess.client.project.findUnique).mockResolvedValue({
                id: 'proj-test-agent',
                name: 'Agent Project',
                projectType: 'AGENT',
            });
            vi.mocked(dataAccess.client.llmGateway.findUnique).mockResolvedValue({ id: 'gateway-1' });

            const agent = mockAgent('agent-my-agent', 'My Agent');
            vi.mocked(dataAccess.client.agent.create).mockResolvedValue(agent);

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
            });
            vi.mocked(dataAccess.client.llmGateway.findUnique).mockResolvedValue({ id: 'gateway-1' });

            const agent = mockAgent('agent-my-agent', 'My Agent');
            vi.mocked(dataAccess.client.agent.create).mockResolvedValue(agent);

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
            });
            vi.mocked(dataAccess.client.llmGateway.findUnique).mockResolvedValue({ id: 'gateway-1' });

            const agent = mockAgent('agent-my-agent', 'My Agent');
            vi.mocked(dataAccess.client.agent.create).mockResolvedValue(agent);

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
            });
            vi.mocked(dataAccess.client.llmGateway.findUnique).mockResolvedValue({ id: 'gateway-1' });

            const agent = mockAgent('agent-my-agent', 'My Agent');
            vi.mocked(dataAccess.client.agent.create).mockResolvedValue(agent);

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
            });
            vi.mocked(dataAccess.client.llmGateway.findUnique).mockResolvedValue({ id: 'gateway-1' });

            const agent = mockAgent('agent-my-agent', 'My Agent');
            vi.mocked(dataAccess.client.agent.create).mockResolvedValue(agent);
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
            });
            vi.mocked(dataAccess.client.llmGateway.findUnique).mockResolvedValue({ id: 'gateway-1' });

            const agent = mockAgent('agent-my-agent', 'My Agent');
            vi.mocked(dataAccess.client.agent.create).mockResolvedValue(agent);
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
});
