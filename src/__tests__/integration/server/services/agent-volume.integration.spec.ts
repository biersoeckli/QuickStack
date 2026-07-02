// @vitest-environment node

import mockNextJsCaching from '@/__tests__/nextjs-cache.utils';
mockNextJsCaching();

import { createPrismaTestContext } from '@/__tests__/prisma-test.utils';
import { revalidateTag } from 'next/cache';
import { Tags } from '@/server/utils/cache-tag-generator.utils';
import agentVolumeService from '@/server/services/agent-volume.service';
import dataAccess from '@/server/adapter/db.client';

describe('agent-volume.service', () => {
    const dbCtx = createPrismaTestContext('agent-volume');

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

    describe('saveVolume', () => {
        it('creates a new volume and revalidates caches', async () => {
            await agentVolumeService.saveVolume({
                agentId,
                containerMountPath: '/data',
                size: 10,
                storageClassName: 'longhorn',
            });

            const volumes = await dataAccess.client.agentVolume.findMany({ where: { agentId } });
            expect(volumes).toHaveLength(1);
            expect(volumes[0].containerMountPath).toBe('/data');
            expect(volumes[0].size).toBe(10);
            expect(volumes[0].storageClassName).toBe('longhorn');

            expect(revalidateTag).toHaveBeenCalledWith(Tags.agent(agentId));
            expect(revalidateTag).toHaveBeenCalledWith(Tags.agents(projectId));
        });

        it('updates an existing volume', async () => {
            const created = await dataAccess.client.agentVolume.create({
                data: { agentId, containerMountPath: '/old', size: 5, storageClassName: 'longhorn' },
            });

            await agentVolumeService.saveVolume({
                id: created.id,
                agentId,
                containerMountPath: '/new',
                size: 20,
                storageClassName: 'longhorn',
            });

            const updated = await dataAccess.client.agentVolume.findUniqueOrThrow({ where: { id: created.id } });
            expect(updated.containerMountPath).toBe('/new');
            expect(updated.size).toBe(20);
        });

        it('rejects update for non-existent volume', async () => {
            await expect(agentVolumeService.saveVolume({
                id: 'non-existent-id',
                agentId,
                containerMountPath: '/tmp',
                size: 1,
                storageClassName: 'longhorn',
            })).rejects.toThrow('Agent volume not found.');
        });
    });

    describe('deleteVolume', () => {
        it('deletes a volume and revalidates caches', async () => {
            const volume = await dataAccess.client.agentVolume.create({
                data: { agentId, containerMountPath: '/delete', size: 5, storageClassName: 'longhorn' },
            });

            await agentVolumeService.deleteVolume(volume.id);

            const remaining = await dataAccess.client.agentVolume.findMany({ where: { agentId } });
            expect(remaining).toHaveLength(0);
            expect(revalidateTag).toHaveBeenCalledWith(Tags.agent(agentId));
            expect(revalidateTag).toHaveBeenCalledWith(Tags.agents(projectId));
        });

        it('does nothing when volume does not exist', async () => {
            await expect(agentVolumeService.deleteVolume('non-existent')).resolves.toBeUndefined();
        });
    });

    describe('getVolumeById', () => {
        it('returns a volume by id', async () => {
            const volume = await dataAccess.client.agentVolume.create({
                data: { agentId, containerMountPath: '/get', size: 15, storageClassName: 'longhorn' },
            });

            const found = await agentVolumeService.getVolumeById(volume.id);
            expect(found.id).toBe(volume.id);
            expect(found.containerMountPath).toBe('/get');
            expect(found.size).toBe(15);
        });

        it('throws for non-existent volume id', async () => {
            await expect(agentVolumeService.getVolumeById('missing')).rejects.toThrow('Agent volume not found.');
        });
    });

    describe('getVolumesForAgent', () => {
        it('returns volumes sorted by createdAt asc', async () => {
            await dataAccess.client.agentVolume.create({
                data: { agentId, containerMountPath: '/second', size: 1, storageClassName: 'longhorn' },
            });
            await new Promise((r) => setTimeout(r, 10));
            await dataAccess.client.agentVolume.create({
                data: { agentId, containerMountPath: '/third', size: 1, storageClassName: 'longhorn' },
            });
            // Update first volume's createdAt by using raw SQL or just check order
            const volumes = await agentVolumeService.getVolumesForAgent(agentId);
            expect(volumes).toHaveLength(2);
            expect(volumes[0].containerMountPath).toBe('/second');
            expect(volumes[1].containerMountPath).toBe('/third');
        });

        it('returns empty array when no volumes exist', async () => {
            const volumes = await agentVolumeService.getVolumesForAgent(agentId);
            expect(volumes).toHaveLength(0);
        });
    });
});
