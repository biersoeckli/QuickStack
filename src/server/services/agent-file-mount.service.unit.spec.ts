const dbAgentFileMountMocks = vi.hoisted(() => ({
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
}));

const agentServiceMocks = vi.hoisted(() => ({
    getById: vi.fn(),
}));

const cacheMocks = vi.hoisted(() => ({
    revalidateTag: vi.fn(),
}));

vi.mock('next/cache', () => ({
    revalidateTag: cacheMocks.revalidateTag,
}));

vi.mock('@/server/adapter/db.client', () => ({
    default: {
        client: {
            agentFileMount: dbAgentFileMountMocks,
        },
    },
}));

vi.mock('./agent.service', () => ({
    default: agentServiceMocks,
}));

import agentFileMountService from './agent-file-mount.service';

describe('agent-file-mount.service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        agentServiceMocks.getById.mockResolvedValue({
            id: 'agent-1',
            projectId: 'project-1',
        });
    });

    it('creates an agent file mount and revalidates agent caches', async () => {
        dbAgentFileMountMocks.create.mockResolvedValue({});

        await agentFileMountService.saveFileMount({
            agentId: 'agent-1',
            containerMountPath: '/workspace/config.yaml',
            content: 'content',
        });

        expect(dbAgentFileMountMocks.create).toHaveBeenCalledWith({
            data: {
                agentId: 'agent-1',
                containerMountPath: '/workspace/config.yaml',
                content: 'content',
            },
        });
        expect(cacheMocks.revalidateTag).toHaveBeenCalledWith('agent-agent-1');
        expect(cacheMocks.revalidateTag).toHaveBeenCalledWith('agents-project-1');
    });

    it('updates an existing agent file mount owned by the agent', async () => {
        dbAgentFileMountMocks.findFirst.mockResolvedValue({ id: 'file-mount-1' });
        dbAgentFileMountMocks.update.mockResolvedValue({});

        await agentFileMountService.saveFileMount({
            id: 'file-mount-1',
            agentId: 'agent-1',
            containerMountPath: '/workspace/config.yaml',
            content: 'updated',
        });

        expect(dbAgentFileMountMocks.findFirst).toHaveBeenCalledWith({
            where: { id: 'file-mount-1', agentId: 'agent-1' },
        });
        expect(dbAgentFileMountMocks.update).toHaveBeenCalledWith({
            where: { id: 'file-mount-1' },
            data: {
                id: 'file-mount-1',
                agentId: 'agent-1',
                containerMountPath: '/workspace/config.yaml',
                content: 'updated',
            },
        });
    });

    it('rejects updates for another agent file mount', async () => {
        dbAgentFileMountMocks.findFirst.mockResolvedValue(null);

        await expect(agentFileMountService.saveFileMount({
            id: 'file-mount-1',
            agentId: 'agent-1',
            containerMountPath: '/workspace/config.yaml',
            content: 'updated',
        })).rejects.toThrow('Agent file mount not found.');

        expect(dbAgentFileMountMocks.update).not.toHaveBeenCalled();
    });

    it('deletes an agent file mount and revalidates agent caches', async () => {
        dbAgentFileMountMocks.findUnique.mockResolvedValue({
            id: 'file-mount-1',
            agentId: 'agent-1',
            agent: { projectId: 'project-1' },
        });
        dbAgentFileMountMocks.delete.mockResolvedValue({});

        await agentFileMountService.deleteFileMount('file-mount-1');

        expect(dbAgentFileMountMocks.delete).toHaveBeenCalledWith({
            where: { id: 'file-mount-1' },
        });
        expect(cacheMocks.revalidateTag).toHaveBeenCalledWith('agent-agent-1');
        expect(cacheMocks.revalidateTag).toHaveBeenCalledWith('agents-project-1');
    });
});
