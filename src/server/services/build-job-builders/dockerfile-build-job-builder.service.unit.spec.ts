import dockerfileBuildJobBuilder from "./dockerfile-build-job-builder.service";

vi.mock('@/server/adapter/kubernetes-api.adapter', () => ({ default: {} }));

describe('DockerfileBuildJobBuilder', () => {
    it('builds a Dockerfile-based build job with queue init container and build annotations', async () => {
        const job = await dockerfileBuildJobBuilder.buildJobDefinition({
            app: {
                id: 'app-1',
                projectId: 'project-1',
                gitUrl: 'https://github.com/example/repo.git',
                gitBranch: 'main',
                dockerfilePath: './apps/web/Dockerfile',
            } as any,
            buildName: 'build-1',
            deploymentId: 'deployment-1',
            latestRemoteGitHash: 'abc123',
            latestRemoteGitCommitMessage: 'feat: test',
            queuedAt: '123',
        });

        expect(job.metadata?.annotations?.['qs-build-method']).toBe('DOCKERFILE');
        expect(job.spec?.template?.metadata?.annotations?.['qs-deplyoment-id']).toBe('deployment-1');
        expect(job.spec?.template?.spec?.initContainers?.map((container) => container.name)).toEqual([
            'build-queue-init',
            'build-git-init',
        ]);
        expect(job.spec?.template?.spec?.volumes).toEqual([
            expect.objectContaining({
                name: 'build-workspace',
                emptyDir: {},
            }),
        ]);

        const buildContainer = job.spec?.template?.spec?.containers[0]!;

        expect(buildContainer.command).toEqual(['buildctl-daemonless.sh']);
        expect(buildContainer.volumeMounts).toEqual([
            { name: 'build-workspace', mountPath: '/workspace' },
        ]);
        expect(buildContainer.args).toEqual(expect.arrayContaining([
            'dockerfile.v0',
            '--local',
            'filename=Dockerfile',
            'context=/workspace/source/apps/web',
            'dockerfile=/workspace/source/apps/web',
        ]));
        expect(buildContainer.args).not.toContain('context=https://github.com/example/repo.git#refs/heads/main:./apps/web');
    });
});
