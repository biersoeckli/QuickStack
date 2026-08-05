vi.mock('next/cache', () => ({
    revalidateTag: vi.fn(),
    unstable_cache: (fn: unknown) => fn,
}));
vi.mock('@/server/adapter/db.client', () => ({
    default: {
        client: {
            project: {
                create: vi.fn(),
                update: vi.fn(),
                findFirstOrThrow: vi.fn(),
            },
        },
    },
}));
vi.mock('@/server/services/namespace.service', () => ({
    default: { createNamespaceIfNotExists: vi.fn() },
}));
vi.mock('@/server/services/build.service', () => ({ default: {} }));
vi.mock('@/server/services/deployment.service', () => ({ default: {} }));

import dataAccess from '@/server/adapter/db.client';
import namespaceService from '@/server/services/namespace.service';
import projectService from './project.service';

describe('project.service Project Type', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('requires Project Type when creating a Project', async () => {
        await expect(projectService.save({ name: 'Missing Type' })).rejects.toThrow(
            'Project Type is required.',
        );

        expect(dataAccess.client.project.create).not.toHaveBeenCalled();
    });

    it('persists the selected Project Type', async () => {
        vi.mocked(dataAccess.client.project.create).mockResolvedValue({
            id: 'proj-agent-project',
            name: 'Agent Project',
            projectType: 'AGENT',
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        const project = await projectService.save({
            name: 'Agent Project',
            projectType: 'AGENT',
        });

        expect(dataAccess.client.project.create).toHaveBeenCalledWith({
            data: {
                id: expect.stringMatching(/^proj-agent-project/),
                name: 'Agent Project',
                projectType: 'AGENT',
            },
        });
        expect(namespaceService.createNamespaceIfNotExists).toHaveBeenCalledWith(project.id);
    });

    it('rejects changing Project Type after creation', async () => {
        vi.mocked(dataAccess.client.project.findFirstOrThrow).mockResolvedValue({
            id: 'proj-agent-project',
            name: 'Agent Project',
            projectType: 'AGENT',
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        await expect(projectService.save({
            id: 'proj-agent-project',
            name: 'Renamed Agent Project',
            projectType: 'APP',
        })).rejects.toThrow('Project Type cannot be changed.');

        expect(dataAccess.client.project.update).not.toHaveBeenCalled();
    });
});
