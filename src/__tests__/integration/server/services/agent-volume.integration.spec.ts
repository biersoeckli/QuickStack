// @vitest-environment node

import mockNextJsCaching from '@/__tests__/nextjs-cache.utils';
mockNextJsCaching();

vi.mock('@/server/services/pvc.service', () => ({
    default: {
        deletePvcsForAgentVolume: vi.fn(),
    },
}));

import { createPrismaTestContext } from '@/__tests__/prisma-test.utils';
import { revalidateTag } from 'next/cache';
import { Tags } from '@/server/utils/cache-tag-generator.utils';
import agentVolumeService from '@/server/services/agent-volume.service';
import pvcService from '@/server/services/pvc.service';
import dataAccess from '@/server/adapter/db.client';

describe('agent-volume.service', () => {
    createPrismaTestContext('agent-volume');

    let projectId: string;
    let llmGatewayId: string;
    let agentId: string;

    beforeEach(async () => {
        vi.clearAllMocks();

        const project = await dataAccess.client.project.create({
            data: { name: 'Test Project' },
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
                modelAlias: JSON.stringify(['test-model']),
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

        it('defaults a new volume to Volume Type ALL and ReadWriteMany', async () => {
            await agentVolumeService.saveVolume({
                agentId,
                containerMountPath: '/data',
                size: 10,
                storageClassName: 'longhorn',
            });

            const volumes = await dataAccess.client.agentVolume.findMany({ where: { agentId } });
            expect(volumes[0].volumeType).toBe('ALL');
            expect(volumes[0].accessMode).toBe('ReadWriteMany');
        });

        it('persists a PER_SANDBOX volume with ReadWriteOnce', async () => {
            await agentVolumeService.saveVolume({
                agentId,
                containerMountPath: '/scratch',
                size: 10,
                storageClassName: 'longhorn',
                volumeType: 'PER_SANDBOX',
                accessMode: 'ReadWriteOnce',
            });

            const volumes = await dataAccess.client.agentVolume.findMany({ where: { agentId } });
            expect(volumes[0].volumeType).toBe('PER_SANDBOX');
            expect(volumes[0].accessMode).toBe('ReadWriteOnce');
        });

        it('persists a PER_SANDBOX volume with ReadWriteMany', async () => {
            await agentVolumeService.saveVolume({
                agentId,
                containerMountPath: '/scratch',
                size: 10,
                storageClassName: 'longhorn',
                volumeType: 'PER_SANDBOX',
                accessMode: 'ReadWriteMany',
            });

            const volumes = await dataAccess.client.agentVolume.findMany({ where: { agentId } });
            expect(volumes[0].volumeType).toBe('PER_SANDBOX');
            expect(volumes[0].accessMode).toBe('ReadWriteMany');
        });

        it('persists a PER_CUSTOM_TAG volume with ReadWriteOnce', async () => {
            await agentVolumeService.saveVolume({
                agentId,
                containerMountPath: '/tag-rwo',
                size: 10,
                storageClassName: 'longhorn',
                volumeType: 'PER_CUSTOM_TAG',
                accessMode: 'ReadWriteOnce',
            });

            const volumes = await dataAccess.client.agentVolume.findMany({ where: { agentId } });
            expect(volumes[0].volumeType).toBe('PER_CUSTOM_TAG');
            expect(volumes[0].accessMode).toBe('ReadWriteOnce');
        });

        it('persists a PER_CUSTOM_TAG volume with ReadWriteMany', async () => {
            await agentVolumeService.saveVolume({
                agentId,
                containerMountPath: '/tag-rwx',
                size: 10,
                storageClassName: 'longhorn',
                volumeType: 'PER_CUSTOM_TAG',
                accessMode: 'ReadWriteMany',
            });

            const volumes = await dataAccess.client.agentVolume.findMany({ where: { agentId } });
            expect(volumes[0].volumeType).toBe('PER_CUSTOM_TAG');
            expect(volumes[0].accessMode).toBe('ReadWriteMany');
        });

        it('rejects combining PER_SANDBOX and PER_CUSTOM_TAG on one Agent', async () => {
            await dataAccess.client.agentVolume.create({
                data: { agentId, containerMountPath: '/sandbox', size: 5, storageClassName: 'longhorn', volumeType: 'PER_SANDBOX', accessMode: 'ReadWriteOnce' },
            });

            await expect(agentVolumeService.saveVolume({
                agentId,
                containerMountPath: '/tag',
                size: 5,
                storageClassName: 'longhorn',
                volumeType: 'PER_CUSTOM_TAG',
                accessMode: 'ReadWriteOnce',
            })).rejects.toThrow('cannot be combined');
        });

        it('rejects combining PER_CUSTOM_TAG and PER_SANDBOX on one Agent', async () => {
            await dataAccess.client.agentVolume.create({
                data: { agentId, containerMountPath: '/tag', size: 5, storageClassName: 'longhorn', volumeType: 'PER_CUSTOM_TAG', accessMode: 'ReadWriteOnce' },
            });

            await expect(agentVolumeService.saveVolume({
                agentId,
                containerMountPath: '/sandbox',
                size: 5,
                storageClassName: 'longhorn',
                volumeType: 'PER_SANDBOX',
                accessMode: 'ReadWriteOnce',
            })).rejects.toThrow('cannot be combined');
        });

        it('allows ALL together with PER_CUSTOM_TAG on one Agent', async () => {
            await dataAccess.client.agentVolume.create({
                data: { agentId, containerMountPath: '/shared', size: 5, storageClassName: 'longhorn', volumeType: 'ALL', accessMode: 'ReadWriteMany' },
            });

            await agentVolumeService.saveVolume({
                agentId,
                containerMountPath: '/tag',
                size: 5,
                storageClassName: 'longhorn',
                volumeType: 'PER_CUSTOM_TAG',
                accessMode: 'ReadWriteOnce',
            });

            const volumes = await dataAccess.client.agentVolume.findMany({ where: { agentId } });
            expect(volumes.map(volume => volume.volumeType).sort()).toEqual(['ALL', 'PER_CUSTOM_TAG']);
        });

        it('rejects an ALL volume with ReadWriteOnce', async () => {
            await expect(agentVolumeService.saveVolume({
                agentId,
                containerMountPath: '/data',
                size: 10,
                storageClassName: 'longhorn',
                volumeType: 'ALL',
                accessMode: 'ReadWriteOnce',
            })).rejects.toThrow('ReadWriteMany');
        });

        it('rejects an unknown volume type', async () => {
            await expect(agentVolumeService.saveVolume({
                agentId,
                containerMountPath: '/data',
                size: 10,
                storageClassName: 'longhorn',
                volumeType: 'SHARED',
            })).rejects.toThrow('Invalid Agent Volume configuration.');
        });

        it('rejects an unknown access mode', async () => {
            await expect(agentVolumeService.saveVolume({
                agentId,
                containerMountPath: '/data',
                size: 10,
                storageClassName: 'longhorn',
                accessMode: 'ReadWriteOncePerSandbox',
            })).rejects.toThrow('Invalid Agent Volume configuration.');
        });

        it('rejects changing the volume type on update', async () => {
            const created = await dataAccess.client.agentVolume.create({
                data: { agentId, containerMountPath: '/data', size: 5, storageClassName: 'longhorn', volumeType: 'ALL', accessMode: 'ReadWriteMany' },
            });

            await expect(agentVolumeService.saveVolume({
                id: created.id,
                agentId,
                containerMountPath: '/data',
                size: 5,
                storageClassName: 'longhorn',
                volumeType: 'PER_SANDBOX',
                accessMode: 'ReadWriteMany',
            })).rejects.toThrow('Volume type cannot be changed');
        });

        it('rejects changing the access mode on update', async () => {
            const created = await dataAccess.client.agentVolume.create({
                data: { agentId, containerMountPath: '/data', size: 5, storageClassName: 'longhorn', volumeType: 'PER_SANDBOX', accessMode: 'ReadWriteMany' },
            });

            await expect(agentVolumeService.saveVolume({
                id: created.id,
                agentId,
                containerMountPath: '/data',
                size: 5,
                storageClassName: 'longhorn',
                volumeType: 'PER_SANDBOX',
                accessMode: 'ReadWriteOnce',
            })).rejects.toThrow('Access mode cannot be changed');
        });

        it('rejects changing the storage class on update', async () => {
            const created = await dataAccess.client.agentVolume.create({
                data: { agentId, containerMountPath: '/data', size: 5, storageClassName: 'longhorn' },
            });

            await expect(agentVolumeService.saveVolume({
                id: created.id,
                agentId,
                containerMountPath: '/data',
                size: 5,
                storageClassName: 'fast',
            })).rejects.toThrow('Storage class cannot be changed');
        });

        it('allows changing the size on update', async () => {
            const created = await dataAccess.client.agentVolume.create({
                data: { agentId, containerMountPath: '/data', size: 5, storageClassName: 'longhorn', volumeType: 'PER_SANDBOX', accessMode: 'ReadWriteOnce' },
            });

            await agentVolumeService.saveVolume({
                id: created.id,
                agentId,
                containerMountPath: '/data',
                size: 50,
                storageClassName: 'longhorn',
                volumeType: 'PER_SANDBOX',
                accessMode: 'ReadWriteOnce',
            });

            const updated = await dataAccess.client.agentVolume.findUniqueOrThrow({ where: { id: created.id } });
            expect(updated.size).toBe(50);
        });

        it('keeps the existing type and access mode when they are omitted on update', async () => {
            const created = await dataAccess.client.agentVolume.create({
                data: { agentId, containerMountPath: '/data', size: 5, storageClassName: 'longhorn', volumeType: 'PER_SANDBOX', accessMode: 'ReadWriteOnce' },
            });

            await agentVolumeService.saveVolume({
                id: created.id,
                agentId,
                containerMountPath: '/data',
                size: 9,
                storageClassName: 'longhorn',
            });

            const updated = await dataAccess.client.agentVolume.findUniqueOrThrow({ where: { id: created.id } });
            expect(updated.volumeType).toBe('PER_SANDBOX');
            expect(updated.accessMode).toBe('ReadWriteOnce');
            expect(updated.size).toBe(9);
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

        it('deletes the per-Custom-Tag PVCs when deleting a PER_CUSTOM_TAG volume', async () => {
            const volume = await dataAccess.client.agentVolume.create({
                data: { agentId, containerMountPath: '/tag', size: 5, storageClassName: 'longhorn', volumeType: 'PER_CUSTOM_TAG', accessMode: 'ReadWriteOnce' },
            });

            await agentVolumeService.deleteVolume(volume.id);

            expect(pvcService.deletePvcsForAgentVolume).toHaveBeenCalledWith(projectId, agentId, volume.id);
        });

        it('does not touch PVCs when deleting a PER_SANDBOX volume', async () => {
            const volume = await dataAccess.client.agentVolume.create({
                data: { agentId, containerMountPath: '/sandbox', size: 5, storageClassName: 'longhorn', volumeType: 'PER_SANDBOX', accessMode: 'ReadWriteOnce' },
            });

            await agentVolumeService.deleteVolume(volume.id);

            expect(pvcService.deletePvcsForAgentVolume).not.toHaveBeenCalled();
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
