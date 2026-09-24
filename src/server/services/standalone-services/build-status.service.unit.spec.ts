vi.mock('@/server/services/build.service', () => ({
    default: {
        getAllBuilds: vi.fn(),
        getBuildsForWorkload: vi.fn(),
        getJobStatusString: vi.fn(),
    },
}));

import buildService from '@/server/services/build.service';
import buildStatusService from '@/server/services/standalone-services/build-status-pub-sub.service';
import type { GlobalBuildJobModel } from '@/shared/model/global-build-job.model';

function makeBuild(overrides: Partial<GlobalBuildJobModel> & Pick<GlobalBuildJobModel, 'workloadId' | 'status'>): GlobalBuildJobModel {
    return {
        name: `build-${overrides.workloadId}`,
        startTime: new Date('2024-01-01T00:00:00Z'),
        workloadType: 'app',
        gitCommit: 'abc123',
        gitCommitMessage: 'feat: build',
        deploymentId: 'deployment-1',
        projectId: 'project-1',
        workloadName: 'My App',
        projectName: 'My Project',
        ...overrides,
    } as GlobalBuildJobModel;
}

describe('BuildStatusService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        buildStatusService.reset();
    });

    describe('applyBuildJobs', () => {
        it('uses the active build over a finished build for the same workload', () => {
            buildStatusService.applyBuildJobs([
                makeBuild({ workloadId: 'app-1', status: 'SUCCEEDED', startTime: new Date('2024-01-01T00:00:00Z') }),
                makeBuild({ workloadId: 'app-1', status: 'RUNNING', name: 'build-active', startTime: new Date('2024-01-02T00:00:00Z') }),
            ]);

            const status = buildStatusService.getStatus('app', 'app-1');
            expect(status?.status).toBe('RUNNING');
            expect(status?.buildName).toBe('build-active');
        });

        it('uses the most recent finished build when no build is active', () => {
            buildStatusService.applyBuildJobs([
                makeBuild({ workloadId: 'app-1', status: 'FAILED', name: 'build-old', startTime: new Date('2024-01-01T00:00:00Z') }),
                makeBuild({ workloadId: 'app-1', status: 'SUCCEEDED', name: 'build-new', startTime: new Date('2024-01-02T00:00:00Z') }),
            ]);

            const status = buildStatusService.getStatus('app', 'app-1');
            expect(status?.status).toBe('SUCCEEDED');
            expect(status?.buildName).toBe('build-new');
        });

        it('keeps builds of different workloads separate', () => {
            buildStatusService.applyBuildJobs([
                makeBuild({ workloadId: 'app-1', status: 'SUCCEEDED' }),
                makeBuild({ workloadId: 'app-2', status: 'FAILED' }),
            ]);

            expect(buildStatusService.getStatus('app', 'app-1')?.status).toBe('SUCCEEDED');
            expect(buildStatusService.getStatus('app', 'app-2')?.status).toBe('FAILED');
        });
    });

    describe('applyJobEvent', () => {
        it('creates a RUNNING status from a watch event', async () => {
            vi.mocked(buildService.getJobStatusString).mockReturnValue('RUNNING');

            await buildStatusService.applyJobEvent('MODIFIED', {
                metadata: {
                    name: 'build-1',
                    annotations: {
                        'qs-workload-type': 'app',
                        'qs-app-id': 'app-1',
                        'qs-project-id': 'project-1',
                        'qs-git-commit': 'abc123',
                    },
                },
            } as any);

            const status = buildStatusService.getStatus('app', 'app-1');
            expect(status?.status).toBe('RUNNING');
            expect(status?.buildName).toBe('build-1');
        });

        it('notifies subscribers when a status changes', async () => {
            const listener = vi.fn();
            buildStatusService.subscribe(listener);
            vi.mocked(buildService.getJobStatusString).mockReturnValue('RUNNING');

            await buildStatusService.applyJobEvent('MODIFIED', {
                metadata: { name: 'build-1', annotations: { 'qs-app-id': 'app-1' } },
            } as any);

            expect(listener).toHaveBeenCalledTimes(1);
            expect(listener).toHaveBeenCalledWith(expect.objectContaining({ workloadId: 'app-1', status: 'RUNNING' }));
        });

        it('does not notify subscribers when the status did not change', async () => {
            const listener = vi.fn();
            buildStatusService.subscribe(listener);
            vi.mocked(buildService.getJobStatusString).mockReturnValue('RUNNING');
            const job = { metadata: { name: 'build-1', annotations: { 'qs-app-id': 'app-1' } } } as any;

            await buildStatusService.applyJobEvent('MODIFIED', job);
            await buildStatusService.applyJobEvent('MODIFIED', job);

            expect(listener).toHaveBeenCalledTimes(1);
        });

        it('does not overwrite a newer finished build with an older finished build', async () => {
            vi.mocked(buildService.getJobStatusString).mockReturnValue('SUCCEEDED');
            await buildStatusService.applyJobEvent('MODIFIED', {
                metadata: { name: 'build-new', annotations: { 'qs-app-id': 'app-1' } },
                status: { startTime: new Date('2024-01-02T00:00:00Z') },
            } as any);

            vi.mocked(buildService.getJobStatusString).mockReturnValue('FAILED');
            await buildStatusService.applyJobEvent('MODIFIED', {
                metadata: { name: 'build-old', annotations: { 'qs-app-id': 'app-1' } },
                status: { startTime: new Date('2024-01-01T00:00:00Z') },
            } as any);

            expect(buildStatusService.getStatus('app', 'app-1')?.buildName).toBe('build-new');
            expect(buildStatusService.getStatus('app', 'app-1')?.status).toBe('SUCCEEDED');
        });

        it('ignores a terminal event of an older build while a newer build is active', async () => {
            vi.mocked(buildService.getJobStatusString).mockReturnValue('RUNNING');
            await buildStatusService.applyJobEvent('MODIFIED', {
                metadata: { name: 'build-active', annotations: { 'qs-app-id': 'app-1' } },
            } as any);

            vi.mocked(buildService.getJobStatusString).mockReturnValue('SUCCEEDED');
            await buildStatusService.applyJobEvent('MODIFIED', {
                metadata: { name: 'build-old', annotations: { 'qs-app-id': 'app-1' } },
            } as any);

            expect(buildStatusService.getStatus('app', 'app-1')?.buildName).toBe('build-active');
            expect(buildStatusService.getStatus('app', 'app-1')?.status).toBe('RUNNING');
        });

        it('falls back to NOT_BUILT when the tracked build is deleted and no builds remain', async () => {
            vi.mocked(buildService.getJobStatusString).mockReturnValue('RUNNING');
            await buildStatusService.applyJobEvent('MODIFIED', {
                metadata: { name: 'build-1', annotations: { 'qs-app-id': 'app-1' } },
            } as any);
            vi.mocked(buildService.getBuildsForWorkload).mockResolvedValue([] as any);

            await buildStatusService.applyJobEvent('DELETED', {
                metadata: { name: 'build-1', annotations: { 'qs-app-id': 'app-1' } },
            } as any);

            expect(buildStatusService.getStatus('app', 'app-1')?.status).toBe('NOT_BUILT');
        });

        it('recomputes the status from remaining builds when the tracked build is deleted', async () => {
            vi.mocked(buildService.getJobStatusString).mockReturnValue('RUNNING');
            await buildStatusService.applyJobEvent('MODIFIED', {
                metadata: { name: 'build-active', annotations: { 'qs-app-id': 'app-1' } },
            } as any);
            vi.mocked(buildService.getBuildsForWorkload).mockResolvedValue([
                makeBuild({ workloadId: 'app-1', status: 'FAILED', name: 'build-older', startTime: new Date('2024-01-01T00:00:00Z') }),
            ] as any);

            await buildStatusService.applyJobEvent('DELETED', {
                metadata: { name: 'build-active', annotations: { 'qs-app-id': 'app-1' } },
            } as any);

            expect(buildStatusService.getStatus('app', 'app-1')?.status).toBe('FAILED');
            expect(buildStatusService.getStatus('app', 'app-1')?.buildName).toBe('build-older');
        });
    });

    describe('ensureSeeded', () => {
        it('seeds from the build service and only lists once for concurrent calls', async () => {
            vi.mocked(buildService.getAllBuilds).mockResolvedValue([
                makeBuild({ workloadId: 'app-1', status: 'SUCCEEDED' }),
            ] as any);

            await Promise.all([
                buildStatusService.ensureSeeded(),
                buildStatusService.ensureSeeded(),
            ]);

            expect(buildService.getAllBuilds).toHaveBeenCalledTimes(1);
            expect(buildStatusService.getStatus('app', 'app-1')?.status).toBe('SUCCEEDED');
        });

        it('rebuilds the cache on every completed seed', async () => {
            vi.mocked(buildService.getAllBuilds)
                .mockResolvedValueOnce([makeBuild({ workloadId: 'app-1', status: 'RUNNING' })] as any)
                .mockResolvedValueOnce([makeBuild({ workloadId: 'app-2', status: 'SUCCEEDED' })] as any);

            await buildStatusService.ensureSeeded();
            await buildStatusService.ensureSeeded();

            expect(buildService.getAllBuilds).toHaveBeenCalledTimes(2);
            expect(buildStatusService.getStatus('app', 'app-1')).toBeUndefined();
            expect(buildStatusService.getStatus('app', 'app-2')?.status).toBe('SUCCEEDED');
        });

        it('propagates seeding errors so callers do not report stale statuses', async () => {
            vi.mocked(buildService.getAllBuilds).mockRejectedValueOnce(new Error('Kubernetes unavailable'));

            await expect(buildStatusService.ensureSeeded()).rejects.toThrow('Kubernetes unavailable');
        });
    });

    describe('subscribe', () => {
        it('isolates a throwing subscriber from other subscribers', async () => {
            const bad = vi.fn(() => { throw new Error('boom'); });
            const good = vi.fn();
            buildStatusService.subscribe(bad);
            buildStatusService.subscribe(good);
            vi.mocked(buildService.getJobStatusString).mockReturnValue('RUNNING');

            await buildStatusService.applyJobEvent('MODIFIED', {
                metadata: { name: 'build-1', annotations: { 'qs-app-id': 'app-1' } },
            } as any);

            expect(good).toHaveBeenCalledTimes(1);
        });

        it('stops notifying after unsubscribe', async () => {
            const listener = vi.fn();
            const unsubscribe = buildStatusService.subscribe(listener);
            unsubscribe();
            vi.mocked(buildService.getJobStatusString).mockReturnValue('RUNNING');

            await buildStatusService.applyJobEvent('MODIFIED', {
                metadata: { name: 'build-1', annotations: { 'qs-app-id': 'app-1' } },
            } as any);

            expect(listener).not.toHaveBeenCalled();
        });
    });
});
