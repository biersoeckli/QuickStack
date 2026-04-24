vi.mock('@/server/adapter/kubernetes-api.adapter', () => ({
    default: {
        batch: {
            createNamespacedJob: vi.fn(),
            listNamespacedJob: vi.fn().mockResolvedValue({ body: { items: [] } }),
            readNamespacedJobStatus: vi.fn(),
        },
        core: {
            listNamespacedPod: vi.fn(),
            readNamespacedPod: vi.fn(),
        },
        log: {
            log: vi.fn(),
        },
    },
}));
vi.mock('@/server/adapter/db.client', () => ({ default: { client: { app: { findMany: vi.fn() } } } }));
vi.mock('@/server/services/namespace.service', () => ({ default: { createNamespaceIfNotExists: vi.fn() } }));
vi.mock('@/server/services/registry.service', () => ({
    __esModule: true,
    BUILD_NAMESPACE: 'qs-build',
    default: {
        deployRegistry: vi.fn(),
        doesImageExist: vi.fn().mockResolvedValue(false),
    },
}));
vi.mock('@/server/services/param.service', () => ({
    __esModule: true,
    ParamService: {
        REGISTRY_SOTRAGE_LOCATION: 'REGISTRY_SOTRAGE_LOCATION',
        BUILD_NODE: 'BUILD_NODE',
        BUILD_MEMORY_LIMIT: 'BUILD_MEMORY_LIMIT',
        BUILD_MEMORY_RESERVATION: 'BUILD_MEMORY_RESERVATION',
        BUILD_CPU_LIMIT: 'BUILD_CPU_LIMIT',
        BUILD_CPU_RESERVATION: 'BUILD_CPU_RESERVATION',
    },
    default: {
        getString: vi.fn(async (key: string) => key === 'REGISTRY_SOTRAGE_LOCATION' ? 'registry-path' : undefined),
        getNumber: vi.fn().mockResolvedValue(undefined),
    },
}));
vi.mock('@/server/services/cluster.service', () => ({
    default: {
        getNodeResourceUsage: vi.fn().mockResolvedValue([]),
        getNodeInfo: vi.fn().mockResolvedValue([]),
    },
}));
vi.mock('@/server/services/build-init-container.service', () => ({
    default: {
        ensureRbacResources: vi.fn(),
    },
}));
vi.mock('@/server/services/git.service', () => ({ default: { openGitContext: vi.fn() } }));
vi.mock('@/server/services/pod.service', () => ({ default: {} }));
vi.mock('@/server/services/deployment-logs.service', () => ({ dlog: vi.fn() }));

import buildService from '@/server/services/build.service';
import gitService from '@/server/services/git.service';
import dockerfileBuildJobBuilder from '@/server/services/build-job-builders/dockerfile-build-job-builder.service';
import railpackBuildJobBuilder from '@/server/services/build-job-builders/railpack-build-job-builder.service';

describe('BuildService.buildApp builder selection', () => {
    const dockerfileCheckSpy = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(dockerfileBuildJobBuilder, 'buildJobDefinition').mockResolvedValue({} as any);
        vi.spyOn(railpackBuildJobBuilder, 'buildJobDefinition').mockResolvedValue({} as any);
        vi.mocked(gitService.openGitContext).mockImplementation(async (_app, fn) => fn({
            checkIfDockerfileExists: dockerfileCheckSpy,
            getLatestRemoteCommitHash: vi.fn().mockResolvedValue('abc123'),
            getLatestRemoteCommitMessage: vi.fn().mockResolvedValue('feat: test'),
        } as any));
    });

    it('uses the Dockerfile builder for Dockerfile apps', async () => {
        await buildService.buildApp('deployment-1', {
            id: 'app-1',
            projectId: 'project-1',
            sourceType: 'GIT',
            buildMethod: 'DOCKERFILE',
            gitUrl: 'https://github.com/example/repo.git',
            gitBranch: 'main',
            dockerfilePath: './Dockerfile',
        } as any);

        expect(dockerfileCheckSpy).toHaveBeenCalled();
        expect(dockerfileBuildJobBuilder.buildJobDefinition).toHaveBeenCalled();
        expect(railpackBuildJobBuilder.buildJobDefinition).not.toHaveBeenCalled();
    });

    it('uses the Railpack builder for Railpack apps', async () => {
        await buildService.buildApp('deployment-1', {
            id: 'app-1',
            projectId: 'project-1',
            sourceType: 'GIT',
            buildMethod: 'RAILPACK',
            gitUrl: 'https://github.com/example/repo.git',
            gitBranch: 'main',
            dockerfilePath: './Dockerfile',
        } as any);

        expect(dockerfileCheckSpy).not.toHaveBeenCalled();
        expect(railpackBuildJobBuilder.buildJobDefinition).toHaveBeenCalled();
        expect(dockerfileBuildJobBuilder.buildJobDefinition).not.toHaveBeenCalled();
    });
});
