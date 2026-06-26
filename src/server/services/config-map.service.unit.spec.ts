const k3sMocks = vi.hoisted(() => ({
    listNamespacedConfigMap: vi.fn(),
    createNamespacedConfigMap: vi.fn(),
    replaceNamespacedConfigMap: vi.fn(),
    deleteNamespacedConfigMap: vi.fn(),
}));

vi.mock('@/server/adapter/kubernetes-api.adapter', () => ({
    default: {
        core: k3sMocks,
    },
}));

import configMapService from './config-map.service';
import { Constants } from '@/shared/utils/constants';

describe('config-map.service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        k3sMocks.listNamespacedConfigMap.mockResolvedValue({ body: { items: [] } });
    });

    it('creates config maps and volume configs for agent file mounts', async () => {
        const agent = {
            id: 'agent-1',
            projectId: 'proj-1',
            agentFileMounts: [{
                id: 'file-mount-1',
                containerMountPath: '/workspace/config.yaml',
                content: 'name: test',
            }],
        } as any;

        const result = await configMapService.createOrUpdateConfigMapForAgent(agent);

        expect(k3sMocks.createNamespacedConfigMap).toHaveBeenCalledWith('proj-1', {
            apiVersion: 'v1',
            kind: 'ConfigMap',
            metadata: {
                name: 'cm-file-mount-1',
                namespace: 'proj-1',
                annotations: {
                    [Constants.QS_ANNOTATION_AGENT_ID]: 'agent-1',
                    [Constants.QS_ANNOTATION_PROJECT_ID]: 'proj-1',
                    'qs-agent-file-mount-id': 'file-mount-1',
                },
            },
            data: {
                'config.yaml': 'name: test',
            },
        });
        expect(result).toEqual({
            fileVolumeMounts: [{
                name: 'cm-file-mount-1',
                mountPath: '/workspace/config.yaml',
                subPath: 'config.yaml',
                readOnly: true,
            }],
            fileVolumes: [{
                name: 'cm-file-mount-1',
                configMap: {
                    name: 'cm-file-mount-1',
                },
            }],
        });
    });

    it('deletes unused agent file mount config maps only', async () => {
        const agent = {
            id: 'agent-1',
            projectId: 'proj-1',
            agentFileMounts: [{
                id: 'file-mount-current',
                containerMountPath: '/workspace/current.yaml',
                content: 'current',
            }],
        } as any;
        k3sMocks.listNamespacedConfigMap.mockResolvedValue({
            body: {
                items: [{
                    metadata: {
                        name: 'cm-file-mount-current',
                        annotations: {
                            [Constants.QS_ANNOTATION_AGENT_ID]: 'agent-1',
                            'qs-agent-file-mount-id': 'file-mount-current',
                        },
                    },
                }, {
                    metadata: {
                        name: 'cm-file-mount-old',
                        annotations: {
                            [Constants.QS_ANNOTATION_AGENT_ID]: 'agent-1',
                            'qs-agent-file-mount-id': 'file-mount-old',
                        },
                    },
                }, {
                    metadata: {
                        name: 'cm-other-agent',
                        annotations: {
                            [Constants.QS_ANNOTATION_AGENT_ID]: 'agent-2',
                            'qs-agent-file-mount-id': 'file-mount-other',
                        },
                    },
                }],
            },
        });

        await configMapService.deleteUnusedConfigMapsForAgent(agent);

        expect(k3sMocks.deleteNamespacedConfigMap).toHaveBeenCalledTimes(1);
        expect(k3sMocks.deleteNamespacedConfigMap).toHaveBeenCalledWith('cm-file-mount-old', 'proj-1');
    });
});
