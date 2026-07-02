// @vitest-environment node

import mockNextJsCaching from '@/__tests__/nextjs-cache.utils';
mockNextJsCaching();

import { createPrismaTestContext } from '@/__tests__/prisma-test.utils';
import { revalidateTag } from 'next/cache';
import { Tags } from '@/server/utils/cache-tag-generator.utils';
import agentFileMountService from '@/server/services/agent-file-mount.service';
import dataAccess from '@/server/adapter/db.client';

describe('agent-file-mount.service', () => {
    const dbCtx = createPrismaTestContext('agent-file-mount');

    let projectId: string;
    let llmGatewayId: string;
    let agentId: string;

    beforeEach(async () => {
        vi.clearAllMocks();

        const project = await dataAccess.client.project.create({
            data: { name: 'Test Project', projectType: 'AGENT' },
        });
        projectId = project.id;

        const gateway = await dataAccess.client.llmGateway.create({
            data: { name: 'Test Gateway', baseUrl: 'http://test', encryptedAdminKey: 'key' },
        });
        llmGatewayId = gateway.id;

        const agent = await dataAccess.client.agent.create({
            data: {
                name: 'Test Agent',
                projectId,
                llmGatewayId,
                modelAlias: 'test-model',
            },
        });
        agentId = agent.id;
    });

    describe('saveFileMount', () => {
        it('creates a new file mount and revalidates caches', async () => {
            await agentFileMountService.saveFileMount({
                agentId,
                containerMountPath: '/workspace/config.yaml',
                content: 'key: value',
            });

            const mounts = await dataAccess.client.agentFileMount.findMany({ where: { agentId } });
            expect(mounts).toHaveLength(1);
            expect(mounts[0].containerMountPath).toBe('/workspace/config.yaml');
            expect(mounts[0].content).toBe('key: value');

            expect(revalidateTag).toHaveBeenCalledWith(Tags.agent(agentId));
            expect(revalidateTag).toHaveBeenCalledWith(Tags.agents(projectId));
        });

        it('updates an existing file mount', async () => {
            const created = await dataAccess.client.agentFileMount.create({
                data: { agentId, containerMountPath: '/old/path.txt', content: 'old' },
            });

            await agentFileMountService.saveFileMount({
                id: created.id,
                agentId,
                containerMountPath: '/new/path.txt',
                content: 'updated content',
            });

            const updated = await dataAccess.client.agentFileMount.findUniqueOrThrow({ where: { id: created.id } });
            expect(updated.containerMountPath).toBe('/new/path.txt');
            expect(updated.content).toBe('updated content');
        });

        it('rejects update when file mount belongs to another agent', async () => {
            const agent2 = await dataAccess.client.agent.create({
                data: { name: 'Agent 2', projectId, llmGatewayId, modelAlias: 'm2' },
            });
            const created = await dataAccess.client.agentFileMount.create({
                data: { agentId: agent2.id, containerMountPath: '/other.txt', content: 'other' },
            });

            await expect(agentFileMountService.saveFileMount({
                id: created.id,
                agentId,
                containerMountPath: '/hijack.txt',
                content: 'stolen',
            })).rejects.toThrow('Agent file mount not found.');
        });
    });

    describe('deleteFileMount', () => {
        it('deletes a file mount and revalidates caches', async () => {
            const mount = await dataAccess.client.agentFileMount.create({
                data: { agentId, containerMountPath: '/delete.txt', content: 'bye' },
            });

            await agentFileMountService.deleteFileMount(mount.id);

            const remaining = await dataAccess.client.agentFileMount.findMany({ where: { agentId } });
            expect(remaining).toHaveLength(0);
            expect(revalidateTag).toHaveBeenCalledWith(Tags.agent(agentId));
            expect(revalidateTag).toHaveBeenCalledWith(Tags.agents(projectId));
        });

        it('does nothing when file mount does not exist', async () => {
            await expect(agentFileMountService.deleteFileMount('non-existent')).resolves.toBeUndefined();
        });
    });

    describe('getFileMountById', () => {
        it('returns a file mount by id', async () => {
            const mount = await dataAccess.client.agentFileMount.create({
                data: { agentId, containerMountPath: '/get.txt', content: 'hello' },
            });

            const found = await agentFileMountService.getFileMountById(mount.id);
            expect(found.id).toBe(mount.id);
            expect(found.content).toBe('hello');
        });

        it('throws for non-existent file mount id', async () => {
            await expect(agentFileMountService.getFileMountById('missing')).rejects.toThrow();
        });
    });
});
