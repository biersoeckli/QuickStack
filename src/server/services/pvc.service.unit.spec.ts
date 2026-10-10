vi.mock('@/server/adapter/kubernetes-api.adapter', () => ({
    default: {
        core: {
            listNamespacedPersistentVolumeClaim: vi.fn(),
            createNamespacedPersistentVolumeClaim: vi.fn(),
            replaceNamespacedPersistentVolumeClaim: vi.fn(),
            deleteNamespacedPersistentVolumeClaim: vi.fn(),
            readPersistentVolume: vi.fn(),
        },
    },
    kubernetesPatchOptions: vi.fn((strategy: unknown) => strategy),
}));

vi.mock('@/server/adapter/db.client', () => ({ default: { client: {} } }));
vi.mock('@/server/services/pod.service', () => ({ default: {} }));

import k3s from '@/server/adapter/kubernetes-api.adapter';
import pvcService from './pvc.service';
import { KubeObjectNameUtils } from '../utils/kube-object-name.utils';
import { Constants } from '@/shared/utils/constants';
import { AgentVolume } from '@prisma/client';

const AGENT_ID = 'agent-1';
const PROJECT_ID = 'proj-1';
const VOLUME_ID = 'vol-1';

function agentVolume(overrides: Partial<AgentVolume> = {}): AgentVolume {
    return {
        id: VOLUME_ID,
        containerMountPath: '/data',
        size: 1024,
        volumeType: 'PER_CUSTOM_TAG',
        accessMode: 'ReadWriteOnce',
        storageClassName: 'longhorn',
        agentId: AGENT_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
    };
}

describe('pvc.service per-custom-tag management', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(k3s.core.listNamespacedPersistentVolumeClaim).mockResolvedValue({ items: [] } as any);
        vi.mocked(k3s.core.createNamespacedPersistentVolumeClaim).mockResolvedValue({} as any);
        vi.mocked(k3s.core.replaceNamespacedPersistentVolumeClaim).mockResolvedValue({} as any);
        vi.mocked(k3s.core.deleteNamespacedPersistentVolumeClaim).mockResolvedValue({} as any);
    });

    describe('ensureAgentTagPvc', () => {
        it('creates a per-Custom-Tag PVC with the volume access mode, storage class and size', async () => {
            const { volume, volumeMount } = await pvcService.ensureAgentTagPvc(PROJECT_ID, agentVolume(), 'alice');

            const expectedName = KubeObjectNameUtils.toAgentTagPvcName(AGENT_ID, VOLUME_ID, 'alice');
            expect(expectedName.startsWith('aw-')).toBe(true);
            expect(k3s.core.createNamespacedPersistentVolumeClaim).toHaveBeenCalledTimes(1);
            expect(k3s.core.createNamespacedPersistentVolumeClaim).toHaveBeenCalledWith(expect.objectContaining({
                namespace: PROJECT_ID,
                body: expect.objectContaining({
                    metadata: expect.objectContaining({
                        name: expectedName,
                        annotations: expect.objectContaining({
                            [Constants.QS_ANNOTATION_AGENT_ID]: AGENT_ID,
                            [Constants.QS_ANNOTATION_AGENT_VOLUME_ID]: VOLUME_ID,
                            [Constants.QS_ANNOTATION_CUSTOM_TAG]: 'alice',
                        }),
                    }),
                    spec: expect.objectContaining({
                        accessModes: ['ReadWriteOnce'],
                        storageClassName: 'longhorn',
                        resources: { requests: { storage: '1Gi' } },
                    }),
                }),
            }));

            expect(volume).toEqual({ name: VOLUME_ID, persistentVolumeClaim: { claimName: expectedName } });
            expect(volumeMount).toEqual({ name: VOLUME_ID, mountPath: '/data' });
        });

        it('reuses an existing per-Custom-Tag PVC without creating it', async () => {
            const pvcName = KubeObjectNameUtils.toAgentTagPvcName(AGENT_ID, VOLUME_ID, 'alice');
            vi.mocked(k3s.core.listNamespacedPersistentVolumeClaim).mockResolvedValue({
                items: [{
                    metadata: { name: pvcName },
                    spec: { resources: { requests: { storage: '1Gi' } } },
                }],
            } as any);

            await pvcService.ensureAgentTagPvc(PROJECT_ID, agentVolume(), 'alice');

            expect(k3s.core.createNamespacedPersistentVolumeClaim).not.toHaveBeenCalled();
            expect(k3s.core.replaceNamespacedPersistentVolumeClaim).not.toHaveBeenCalled();
        });

        it('grows an existing per-Custom-Tag PVC when the desired size is larger', async () => {
            const pvcName = KubeObjectNameUtils.toAgentTagPvcName(AGENT_ID, VOLUME_ID, 'alice');
            vi.mocked(k3s.core.listNamespacedPersistentVolumeClaim).mockResolvedValue({
                items: [{
                    metadata: { name: pvcName },
                    spec: { resources: { requests: { storage: '1Gi' } } },
                }],
            } as any);

            await pvcService.ensureAgentTagPvc(PROJECT_ID, agentVolume({ size: 4096 }), 'alice');

            expect(k3s.core.replaceNamespacedPersistentVolumeClaim).toHaveBeenCalledTimes(1);
            expect(k3s.core.replaceNamespacedPersistentVolumeClaim).toHaveBeenCalledWith(expect.objectContaining({
                name: pvcName,
                namespace: PROJECT_ID,
                body: expect.objectContaining({
                    spec: expect.objectContaining({ resources: { requests: { storage: '4Gi' } } }),
                }),
            }));
        });
    });

    describe('deletePvcForAgentTag', () => {
        it('deletes only PVCs annotated with the given Custom Tag', async () => {
            vi.mocked(k3s.core.listNamespacedPersistentVolumeClaim).mockResolvedValue({
                items: [
                    { metadata: { name: 'aw-alice', annotations: { [Constants.QS_ANNOTATION_AGENT_ID]: AGENT_ID, [Constants.QS_ANNOTATION_CUSTOM_TAG]: 'alice' } } },
                    { metadata: { name: 'aw-bob', annotations: { [Constants.QS_ANNOTATION_AGENT_ID]: AGENT_ID, [Constants.QS_ANNOTATION_CUSTOM_TAG]: 'bob' } } },
                ],
            } as any);

            await pvcService.deletePvcForAgentTag(PROJECT_ID, AGENT_ID, 'alice');

            expect(k3s.core.deleteNamespacedPersistentVolumeClaim).toHaveBeenCalledTimes(1);
            expect(k3s.core.deleteNamespacedPersistentVolumeClaim).toHaveBeenCalledWith({ name: 'aw-alice', namespace: PROJECT_ID });
        });
    });

    describe('deleteUnusedPvcForAgent', () => {
        it('never deletes a per-Custom-Tag PVC on deploy', async () => {
            vi.mocked(k3s.core.listNamespacedPersistentVolumeClaim).mockResolvedValue({
                items: [
                    { metadata: { name: 'aw-tag', annotations: { [Constants.QS_ANNOTATION_AGENT_ID]: AGENT_ID, [Constants.QS_ANNOTATION_AGENT_VOLUME_ID]: 'tag-vol', [Constants.QS_ANNOTATION_CUSTOM_TAG]: 'alice' } } },
                    { metadata: { name: 'aw-unused', annotations: { [Constants.QS_ANNOTATION_AGENT_ID]: AGENT_ID, [Constants.QS_ANNOTATION_AGENT_VOLUME_ID]: 'stale-all-vol' } } },
                ],
            } as any);

            await pvcService.deleteUnusedPvcForAgent(PROJECT_ID, AGENT_ID, [
                agentVolume({ id: 'shared-vol', volumeType: 'ALL', accessMode: 'ReadWriteMany' }),
                agentVolume({ id: 'tag-vol', volumeType: 'PER_CUSTOM_TAG' }),
            ]);

            expect(k3s.core.deleteNamespacedPersistentVolumeClaim).toHaveBeenCalledTimes(1);
            expect(k3s.core.deleteNamespacedPersistentVolumeClaim).toHaveBeenCalledWith({ name: 'aw-unused', namespace: PROJECT_ID });
        });
    });
});
