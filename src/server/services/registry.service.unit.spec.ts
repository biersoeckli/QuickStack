vi.mock('@/server/adapter/kubernetes-api.adapter', () => ({ default: {} }));
vi.mock('./namespace.service', () => ({ default: {} }));
vi.mock('./cluster.service', () => ({ default: {} }));
vi.mock('./s3-target.service', () => ({ default: {} }));
vi.mock('@/server/adapter/aws-s3.adapter', () => ({ default: {} }));

const podServiceMocks = vi.hoisted(() => ({
    getPodsForApp: vi.fn(),
    runCommandInPod: vi.fn(),
}));
vi.mock('./pod.service', () => ({ default: podServiceMocks }));

const registryApiAdapterMocks = vi.hoisted(() => ({
    getAllImages: vi.fn(),
    listTagsForImage: vi.fn(),
    deleteImage: vi.fn(),
}));
vi.mock('@/server/adapter/registry-api.adapter', () => ({ default: registryApiAdapterMocks }));

import registryService, { BUILD_NAMESPACE } from './registry.service';

describe('registry.service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        podServiceMocks.getPodsForApp.mockResolvedValue([{ podName: 'registry-pod', containerName: 'registry' }]);
        podServiceMocks.runCommandInPod.mockResolvedValue(undefined);
        registryApiAdapterMocks.getAllImages.mockResolvedValue([]);
    });

    it('resolves the mounted registry config before running garbage collection', async () => {
        await registryService.purgeRegistryImages();

        expect(registryApiAdapterMocks.getAllImages).toHaveBeenCalled();
        expect(podServiceMocks.runCommandInPod).toHaveBeenCalledTimes(1);

        const [namespace, podName, containerName, command] = podServiceMocks.runCommandInPod.mock.calls[0];
        expect(namespace).toBe(BUILD_NAMESPACE);
        expect(podName).toBe('registry-pod');
        expect(containerName).toBe('registry');
        expect(command[0]).toBe('sh');
        expect(command[1]).toBe('-c');
        expect(command[2]).toContain('/etc/distribution/config.yml');
        expect(command[2]).toContain('/etc/docker/registry/config.yml');
        expect(command[2]).toContain('bin/registry garbage-collect "$config"');
    });

    it('throws when the registry pod is not running', async () => {
        podServiceMocks.getPodsForApp.mockResolvedValue([]);

        await expect(registryService.purgeRegistryImages()).rejects.toThrow(
            'Cannot run garbage collection, because registry is not running.',
        );
        expect(podServiceMocks.runCommandInPod).not.toHaveBeenCalled();
    });
});
