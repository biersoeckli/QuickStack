vi.mock('@kubernetes/client-node', async () => {
    const actual = await vi.importActual<typeof import('@kubernetes/client-node')>('@kubernetes/client-node');
    class WatchMock {
        watch = vi.fn().mockResolvedValue({ abort: vi.fn() });
    }
    return {
        ...actual,
        Watch: WatchMock,
    };
});

vi.mock('@/server/adapter/kubernetes-api.adapter', () => ({
    default: {
        getKubeConfig: vi.fn(),
        batch: {
            listNamespacedJob: vi.fn().mockResolvedValue({ body: { items: [] } }),
        },
    },
}));
vi.mock('@/server/services/build.service', () => ({
    default: {
        getJobStatusString: vi.fn(),
    },
}));
vi.mock('@/server/services/deployment.service', () => ({
    default: {
        getDeployment: vi.fn(),
        createDeployment: vi.fn(),
    },
}));
vi.mock('@/server/services/app.service', () => ({
    default: {
        getExtendedById: vi.fn(),
    },
}));
vi.mock('@/server/services/deployment-logs.service', () => ({
    dlog: vi.fn(),
}));
vi.mock('@/server/services/registry.service', () => ({
    BUILD_NAMESPACE: 'qs-build',
}));

import buildService from '@/server/services/build.service';
import buildWatchService from '@/server/services/standalone-services/build-watch.service';
import deploymentService from '@/server/services/deployment.service';
import appService from '@/server/services/app.service';

describe('BuildWatchService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (buildWatchService as any).processedJobs.clear();
    });

    it('ignores pending jobs and does not trigger deployment work', async () => {
        vi.mocked(buildService.getJobStatusString).mockReturnValue('PENDING');

        await (buildWatchService as any).handleJobEvent({
            metadata: {
                name: 'build-1',
                annotations: {
                    'qs-deplyoment-id': 'deployment-1',
                },
            },
        });

        expect(deploymentService.createDeployment).not.toHaveBeenCalled();
    });

    it('logs failed jobs without triggering deployment', async () => {
        await (buildWatchService as any).handleFailed({
            metadata: {
                name: 'build-1',
                annotations: {
                    'qs-deplyoment-id': 'deployment-1',
                },
            },
        });

        expect(deploymentService.createDeployment).not.toHaveBeenCalled();
    });

    it('triggers deployment for succeeded jobs', async () => {
        vi.mocked(appService.getExtendedById).mockResolvedValue({
            buildMethod: 'RAILPACK',
        } as any);

        await (buildWatchService as any).handleSucceeded({
            metadata: {
                name: 'build-1',
                annotations: {
                    'qs-deplyoment-id': 'deployment-1',
                    'qs-app-id': 'app-1',
                    'qs-git-commit': 'abc123',
                    'qs-git-commit-message': 'feat: test',
                    'qs-build-method': 'RAILPACK',
                },
            },
        });

        expect(deploymentService.createDeployment).toHaveBeenCalled();
    });
});
