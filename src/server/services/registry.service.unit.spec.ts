const k3sMocks = vi.hoisted(() => ({
    core: {
        listNamespacedConfigMap: vi.fn(),
        createNamespacedConfigMap: vi.fn(),
        deleteNamespacedConfigMap: vi.fn(),
        listNamespacedPersistentVolumeClaim: vi.fn(),
        createNamespacedPersistentVolumeClaim: vi.fn(),
        listNamespacedService: vi.fn(),
        createNamespacedService: vi.fn(),
        deleteNamespacedService: vi.fn(),
    },
    apps: {
        listNamespacedDeployment: vi.fn(),
        deleteNamespacedDeployment: vi.fn(),
        createNamespacedDeployment: vi.fn(),
    },
}));
vi.mock('@/server/adapter/kubernetes-api.adapter', () => ({ default: k3sMocks }));

const namespaceServiceMocks = vi.hoisted(() => ({ createNamespaceIfNotExists: vi.fn() }));
vi.mock('./namespace.service', () => ({ default: namespaceServiceMocks }));

const clusterServiceMocks = vi.hoisted(() => ({ getFirstMasterNode: vi.fn() }));
vi.mock('./cluster.service', () => ({ default: clusterServiceMocks }));

vi.mock('./s3-target.service', () => ({ default: { getById: vi.fn(), existsById: vi.fn() } }));
vi.mock('@/server/adapter/aws-s3.adapter', () => ({ default: {} }));

const podServiceMocks = vi.hoisted(() => ({
    getPodsForApp: vi.fn(),
    runCommandInPod: vi.fn(),
    waitUntilPodIsRunningFailedOrSucceded: vi.fn(),
}));
vi.mock('./pod.service', () => ({ default: podServiceMocks }));

const registryApiAdapterMocks = vi.hoisted(() => ({
    getAllImages: vi.fn(),
    listTagsForImage: vi.fn(),
    deleteImage: vi.fn(),
}));
vi.mock('@/server/adapter/registry-api.adapter', () => ({ default: registryApiAdapterMocks }));

import registryService, { BUILD_NAMESPACE } from './registry.service';
import { Constants } from '@/shared/utils/constants';

function registryDeployment(image: string) {
    return {
        metadata: { name: 'registry' },
        spec: { template: { spec: { containers: [{ name: 'registry', image }] } } },
    };
}

describe('registry.service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        k3sMocks.core.listNamespacedConfigMap.mockResolvedValue({ items: [] });
        k3sMocks.core.listNamespacedPersistentVolumeClaim.mockResolvedValue({ items: [] });
        k3sMocks.core.listNamespacedService.mockResolvedValue({ items: [] });
        clusterServiceMocks.getFirstMasterNode.mockResolvedValue({ name: 'master' });
        podServiceMocks.getPodsForApp.mockResolvedValue([]);
    });

    it('runs garbage collection against the mounted v3 config', async () => {
        podServiceMocks.getPodsForApp.mockResolvedValue([{ podName: 'registry-pod', containerName: 'registry' }]);
        registryApiAdapterMocks.getAllImages.mockResolvedValue([]);

        await registryService.purgeRegistryImages();

        expect(podServiceMocks.runCommandInPod).toHaveBeenCalledWith(
            BUILD_NAMESPACE,
            'registry-pod',
            'registry',
            ['bin/registry', 'garbage-collect', '/etc/distribution/config.yml'],
        );
    });

    it('throws when the registry pod is not running', async () => {
        podServiceMocks.getPodsForApp.mockResolvedValue([]);

        await expect(registryService.purgeRegistryImages()).rejects.toThrow(
            'Cannot run garbage collection, because registry is not running.',
        );
        expect(podServiceMocks.runCommandInPod).not.toHaveBeenCalled();
    });

    it('does not redeploy the registry when it already runs the latest image', async () => {
        k3sMocks.apps.listNamespacedDeployment.mockResolvedValue({ items: [registryDeployment('registry:3.1.1')] });

        await registryService.deployRegistry(Constants.INTERNAL_REGISTRY_LOCATION);

        expect(clusterServiceMocks.getFirstMasterNode).not.toHaveBeenCalled();
        expect(k3sMocks.apps.createNamespacedDeployment).not.toHaveBeenCalled();
    });

    it('redeploys the registry when the deployed image is outdated', async () => {
        k3sMocks.apps.listNamespacedDeployment.mockResolvedValue({ items: [registryDeployment('registry:2.8')] });
        vi.useFakeTimers();

        try {
            const deploy = registryService.deployRegistry(Constants.INTERNAL_REGISTRY_LOCATION);
            await vi.runAllTimersAsync();
            await deploy;
        } finally {
            vi.useRealTimers();
        }

        expect(k3sMocks.apps.deleteNamespacedDeployment).toHaveBeenCalledWith({
            name: 'registry',
            namespace: BUILD_NAMESPACE,
        });
        expect(k3sMocks.apps.createNamespacedDeployment).toHaveBeenCalledWith({
            namespace: BUILD_NAMESPACE,
            body: expect.objectContaining({
                spec: expect.objectContaining({
                    template: expect.objectContaining({
                        spec: expect.objectContaining({
                            containers: [expect.objectContaining({ image: 'registry:3.1.1' })],
                        }),
                    }),
                }),
            }),
        });
    });
});
