import railpackBuildJobBuilder, { RAILPACK_FRONTEND_IMAGE } from "./railpack-build-job-builder.service";

vi.mock('@/server/adapter/kubernetes-api.adapter', () => ({ default: {} }));

describe('RailpackBuildJobBuilder', () => {
    it('builds a Railpack job with queue init, prepare init, shared volume, and frontend image', async () => {
        const job = await railpackBuildJobBuilder.buildJobDefinition({
            app: {
                id: 'app-1',
                projectId: 'project-1',
                gitUrl: 'https://github.com/example/repo.git',
                gitBranch: 'main',
            } as any,
            buildName: 'build-1',
            deploymentId: 'deployment-1',
            latestRemoteGitHash: 'abc123',
            latestRemoteGitCommitMessage: 'feat: test',
            queuedAt: '123',
        });

        const initContainers = job.spec?.template?.spec?.initContainers ?? [];
        const buildContainer = job.spec?.template?.spec?.containers[0]!;

        expect(job.metadata?.annotations?.['qs-build-method']).toBe('RAILPACK');
        expect(job.spec?.template?.metadata?.annotations?.['qs-deplyoment-id']).toBe('deployment-1');
        expect(initContainers.map((container) => container.name)).toEqual([
            'build-queue-init',
            'build-git-init',
            'railpack-prepare-init',
        ]);
        expect(job.spec?.template?.spec?.volumes).toEqual([
            expect.objectContaining({
                name: 'build-workspace',
                emptyDir: {},
            }),
        ]);
        expect(buildContainer.args).toEqual(expect.arrayContaining([
            'gateway.v0',
            `source=${RAILPACK_FRONTEND_IMAGE}`,
            'context=/workspace/source',
            'dockerfile=/workspace/plan',
        ]));

        const prepareContainer = initContainers.find((container) => container.name === 'railpack-prepare-init')!;
        expect(prepareContainer.env?.map((entry) => entry.name)).not.toContain('GIT_URL');
        expect(prepareContainer.args?.[0]).not.toContain('git clone');
    });
});
