// @vitest-environment node

import mockNextJsCaching from '@/__tests__/nextjs-cache.utils';
mockNextJsCaching();

import { createPrismaTestContext } from '@/__tests__/prisma-test.utils';
import { revalidateTag } from 'next/cache';
import { Tags } from '@/server/utils/cache-tag-generator.utils';
import namespaceService from '@/server/services/namespace.service';
import projectService from '@/server/services/project.service';
import { createK3sTestContext } from '@/__tests__/k3s-test.utils';

describe('project.service', () => {
    const dbCtx = createPrismaTestContext('project-service');
    const { getClients, getKubeConfig } = createK3sTestContext();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('save', () => {

        it('creates a new project in database', async () => {
            await projectService.save({ name: 'Test Project' });

            const projectsDirectlyFromDatabase = await dbCtx.getDataAccess().client.project.findMany();
            const projectsFromService = await projectService.getAllProjects();

            expect(projectsFromService).toHaveLength(1);
            expect(projectsFromService[0].name).toBe('Test Project');

            expect(projectsDirectlyFromDatabase).toHaveLength(1);
            expect(projectsDirectlyFromDatabase[0].name).toBe('Test Project');
            expect(projectsDirectlyFromDatabase[0].id).toMatch(/^proj-/);
            expect(revalidateTag).toHaveBeenCalledWith(Tags.projects());
        });

        it('creates a new namespace in k3s cluster', async () => {
            const projectName = 'Test Project 2';
            const savedProject = await projectService.save({ name: projectName });

            const allNamespaces = await namespaceService.getNamespaces();
            expect(allNamespaces.find(namespace => namespace === savedProject.id)).toBeTruthy();
        });

        it('updates an existing project', async () => {
            const created = await projectService.save({ name: 'Initial Project' });

            const updated = await projectService.save({
                id: created.id,
                name: 'Updated Project',
            });

            expect(updated.id).toBe(created.id);
            expect(updated.name).toBe('Updated Project');

            const saved = await dbCtx.getDataAccess().client.project.findUniqueOrThrow({
                where: { id: created.id },
            });
            expect(saved.name).toBe('Updated Project');
            const allNamespaces = await namespaceService.getNamespaces();
            expect(allNamespaces.find(namespace => namespace === created.id)).toBeTruthy(); // kubernetes namespace does not change
            expect(revalidateTag).toHaveBeenCalledWith(Tags.projects());
        });
    });

    describe('getAllProjects', () => {
        it('returns projects sorted by name asc', async () => {
            await projectService.save({ name: 'Zulu' });
            await projectService.save({ name: 'Alpha' });

            const projects = await projectService.getAllProjects();

            expect(projects).toHaveLength(2);
            expect(projects.map((item) => item.name)).toEqual(['Alpha', 'Zulu']);
            expect(projects.every((item) => Array.isArray(item.apps))).toBe(true);
        });
    });

    describe('getById', () => {
        it('returns an existing project by id', async () => {
            const created = await projectService.save({ name: 'By Id Project' });

            const loaded = await projectService.getById(created.id);

            expect(loaded.id).toBe(created.id);
            expect(loaded.name).toBe('By Id Project');
        });

        it('throws for missing project id', async () => {
            await expect(projectService.getById('missing-project-id')).rejects.toThrow();
        });
    });

    describe('deleteById', () => {
        it('deletes existing project and triggers side effects', async () => {
            const created = await projectService.save({ name: 'Project To Delete' });

            await projectService.deleteById(created.id);

            // wait 3 seconds for k3s to process the namespace deletion before we check the results
            await new Promise((resolve) => setTimeout(resolve, 3000));

            const projects = await dbCtx.getDataAccess().client.project.findMany();
            const allNamespaces = await namespaceService.getNamespaces();

            expect(projects).toHaveLength(0);
            // expect(allNamespaces.find(namespace => namespace === created.id)).toBeFalsy();
            expect(revalidateTag).toHaveBeenCalledWith(Tags.projects());
            expect(revalidateTag).toHaveBeenCalledWith(Tags.userGroups());
            expect(revalidateTag).toHaveBeenCalledWith(Tags.users());
        });

        it('throws when project does not exist', async () => {
            await expect(projectService.deleteById('missing-project-id')).rejects.toThrow();
        });
    });
});
