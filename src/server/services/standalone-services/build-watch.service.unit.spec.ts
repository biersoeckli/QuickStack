const k8sMocks = vi.hoisted(() => ({
    watch: vi.fn(),
    abort: vi.fn(),
    listNamespacedJob: vi.fn(),
}));

vi.mock('@kubernetes/client-node', async () => {
    const actual = await vi.importActual<typeof import('@kubernetes/client-node')>('@kubernetes/client-node');
    class WatchMock {
        watch = k8sMocks.watch;
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
            listNamespacedJob: k8sMocks.listNamespacedJob,
        },
    },
}));
vi.mock('@/server/services/build.service', () => ({
    default: {
        getJobStatusString: vi.fn(),
        getAllBuilds: vi.fn().mockResolvedValue([]),
        getBuildsForWorkload: vi.fn().mockResolvedValue([]),
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
vi.mock('@/server/services/app-git-ssh-key.service', () => ({
    default: {
        deleteTemporaryBuildSecret: vi.fn(),
    },
}));
vi.mock('@/server/services/standalone-services/build-status-pub-sub.service', () => ({
    default: {
        ensureSeeded: vi.fn().mockResolvedValue(undefined),
        applyJobEvent: vi.fn().mockResolvedValue(undefined),
    },
}));

import buildService from '@/server/services/build.service';
import buildWatchService from '@/server/services/standalone-services/build-watch.service';
import buildStatusService from '@/server/services/standalone-services/build-status-pub-sub.service';
import deploymentService from '@/server/services/deployment.service';
import appService from '@/server/services/app.service';
import appGitSshKeyService from '@/server/services/app-git-ssh-key.service';

describe('BuildWatchService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (buildWatchService as any).processedJobs.clear();
        (buildWatchService as any).isWatchRunning = false;
        k8sMocks.watch.mockResolvedValue({ abort: k8sMocks.abort });
        k8sMocks.listNamespacedJob.mockResolvedValue({ items: [] });
    });

    it('seeds the build status service and forwards job events to it', async () => {
        vi.mocked(buildService.getJobStatusString).mockReturnValue('PENDING');

        await buildWatchService.startWatch();

        expect(buildStatusService.ensureSeeded).toHaveBeenCalledTimes(1);
        expect(k8sMocks.watch).toHaveBeenCalledTimes(1);

        const eventHandler = k8sMocks.watch.mock.calls[0][2] as (type: string, job: unknown) => Promise<void>;
        const job = { metadata: { name: 'build-1', annotations: { 'qs-app-id': 'app-1' } } };
        await eventHandler('MODIFIED', job);

        expect(buildStatusService.applyJobEvent).toHaveBeenCalledWith('MODIFIED', job);
    });

    it('still handles a completed build when status tracking fails', async () => {
        vi.mocked(buildStatusService.applyJobEvent).mockRejectedValueOnce(new Error('status unavailable'));
        vi.mocked(buildService.getJobStatusString).mockReturnValue('SUCCEEDED');
        vi.mocked(appService.getExtendedById).mockResolvedValue({ buildMethod: 'RAILPACK' } as any);

        await buildWatchService.startWatch();
        const eventHandler = k8sMocks.watch.mock.calls[0][2] as (type: string, job: unknown) => Promise<void>;
        await eventHandler('MODIFIED', {
            metadata: {
                name: 'build-1',
                annotations: {
                    'qs-deplyoment-id': 'deployment-1',
                    'qs-app-id': 'app-1',
                },
            },
        });

        expect(deploymentService.createDeployment).toHaveBeenCalledTimes(1);
    });

    it('ignores pending jobs and does not trigger deployment work', async () => {
        vi.mocked(buildService.getJobStatusString).mockReturnValue('PENDING');

        await (buildWatchService as any).handleJobEvent('MODIFIED', {
            metadata: {
                name: 'build-1',
                annotations: {
                    'qs-deplyoment-id': 'deployment-1',
                    'qs-git-ssh-secret': 'git-ssh-build-1',
                },
            },
        });

        expect(deploymentService.createDeployment).not.toHaveBeenCalled();
        expect(appGitSshKeyService.deleteTemporaryBuildSecret).not.toHaveBeenCalled();
    });

    it('logs failed jobs without triggering deployment', async () => {
        await (buildWatchService as any).handleFailed({
            metadata: {
                name: 'build-1',
                annotations: {
                    'qs-deplyoment-id': 'deployment-1',
                    'qs-git-ssh-secret': 'git-ssh-build-1',
                },
            },
        });

        expect(deploymentService.createDeployment).not.toHaveBeenCalled();
        expect(appGitSshKeyService.deleteTemporaryBuildSecret).toHaveBeenCalledWith('git-ssh-build-1');
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
                    'qs-is-rollback': 'true',
                    'qs-git-ssh-secret': 'git-ssh-build-1',
                },
            },
        });

        expect(deploymentService.createDeployment).toHaveBeenCalledWith(
            'deployment-1',
            expect.anything(),
            expect.objectContaining({
                buildJobName: 'build-1',
                gitCommitHash: 'abc123',
                gitCommitMessage: 'feat: test',
                buildMethod: 'RAILPACK',
                isRollback: true,
            }),
        );
        expect(appGitSshKeyService.deleteTemporaryBuildSecret).toHaveBeenCalledWith('git-ssh-build-1');
    });

    it('does not redeploy an old successful build replayed as ADDED after startup', async () => {
        vi.mocked(buildService.getJobStatusString).mockReturnValue('SUCCEEDED');
        k8sMocks.listNamespacedJob.mockResolvedValue({
            items: [{ metadata: { name: 'old-build' }, status: { succeeded: 1 } }],
        });
        vi.mocked(appService.getExtendedById).mockResolvedValue({ buildMethod: 'RAILPACK' } as any);

        await buildWatchService.startWatch();
        const eventHandler = k8sMocks.watch.mock.calls[0][2] as (type: string, job: unknown) => Promise<void>;
        await eventHandler('ADDED', {
            metadata: {
                name: 'old-build',
                annotations: {
                    'qs-deplyoment-id': 'deployment-1',
                    'qs-app-id': 'app-1',
                },
            },
        });

        expect(deploymentService.createDeployment).not.toHaveBeenCalled();
    });

    it('still deploys a running build once it succeeds after startup', async () => {
        vi.mocked(buildService.getJobStatusString).mockImplementation((status?: any) => {
            if (status?.succeeded) return 'SUCCEEDED';
            if (status?.active) return 'PENDING';
            return 'UNKNOWN';
        });
        k8sMocks.listNamespacedJob.mockResolvedValue({
            items: [{ metadata: { name: 'running-build' }, status: { active: 1 } }],
        });
        vi.mocked(appService.getExtendedById).mockResolvedValue({ buildMethod: 'RAILPACK' } as any);

        await buildWatchService.startWatch();
        const eventHandler = k8sMocks.watch.mock.calls[0][2] as (type: string, job: unknown) => Promise<void>;
        await eventHandler('MODIFIED', {
            metadata: {
                name: 'running-build',
                annotations: {
                    'qs-deplyoment-id': 'deployment-1',
                    'qs-app-id': 'app-1',
                },
            },
            status: { succeeded: 1 },
        });

        expect(deploymentService.createDeployment).toHaveBeenCalledTimes(1);
    });

    it('ignores DELETED job events even when the job shows as succeeded', async () => {
        vi.mocked(buildService.getJobStatusString).mockReturnValue('SUCCEEDED');

        await (buildWatchService as any).handleJobEvent('DELETED', {
            metadata: {
                name: 'build-1',
                annotations: {
                    'qs-deplyoment-id': 'deployment-1',
                    'qs-app-id': 'app-1',
                },
            },
        });

        expect(deploymentService.createDeployment).not.toHaveBeenCalled();
    });
});
