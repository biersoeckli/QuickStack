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
                findMany: vi.fn(),
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

describe('project.service lean read queries', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('loads only workload id and name for sidebar navigation', async () => {
        vi.mocked(dataAccess.client.project.findMany).mockResolvedValue([] as never);

        await projectService.getAllForNavigation();

        const query = vi.mocked(dataAccess.client.project.findMany).mock.calls[0][0] as unknown as {
            include?: unknown;
            select: Record<string, unknown>;
        };
        expect(query.include).toBeUndefined();
        expect(query.select).toEqual(expect.objectContaining({
            id: true,
            name: true,
            projectType: true,
            createdAt: true,
            updatedAt: true,
            apps: { select: { id: true, name: true } },
            agents: { select: { id: true, name: true } },
        }));
        expect(query.select._count).toBeUndefined();
    });

    it('loads agent counts instead of agent records for the projects table', async () => {
        vi.mocked(dataAccess.client.project.findMany).mockResolvedValue([] as never);

        await projectService.getAllWithCounts();

        const query = vi.mocked(dataAccess.client.project.findMany).mock.calls[0][0] as unknown as {
            include?: unknown;
            select: Record<string, unknown>;
        };
        expect(query.include).toBeUndefined();
        expect(query.select).toEqual(expect.objectContaining({
            id: true,
            name: true,
            projectType: true,
            createdAt: true,
            updatedAt: true,
            _count: { select: { apps: true, agents: true } },
        }));
        expect(query.select.apps).toBeUndefined();
        expect(query.select.agents).toBeUndefined();
    });
});
