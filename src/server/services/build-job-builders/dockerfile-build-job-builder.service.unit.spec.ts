import dockerfileBuildJobBuilder from "./dockerfile-build-job-builder.service";

vi.mock('@/server/adapter/kubernetes-api.adapter', () => ({ default: {} }));

describe('DockerfileBuildJobBuilder', () => {
    it('builds a Dockerfile-based build job with queue init container and build annotations', async () => {
        const job = await dockerfileBuildJobBuilder.buildJobDefinition({
            workload: {
                id: 'app-1',
                projectId: 'project-1',
                gitUrl: 'https://github.com/example/repo.git',
                gitBranch: 'main',
                dockerfilePath: './apps/web/Dockerfile',
            } as any,
            workloadType: 'app',
            buildName: 'build-1',
            deploymentId: 'deployment-1',
            latestRemoteGitHash: 'abc123',
            latestRemoteGitCommitMessage: 'feat: test',
            queuedAt: '123',
            maxParallelBuilds: 2,
        });

        expect(job.metadata?.annotations?.['qs-build-method']).toBe('DOCKERFILE');
        expect(job.metadata?.annotations?.['qs-is-rollback']).toBeUndefined();
        expect(job.spec?.template?.metadata?.annotations?.['qs-deplyoment-id']).toBe('deployment-1');
        expect(job.spec?.template?.spec?.initContainers?.map((container) => container.name)).toEqual([
            'build-queue-init',
            'build-git-init',
        ]);
        const queueInitContainer = job.spec?.template?.spec?.initContainers?.find((container) => container.name === 'build-queue-init')!;
        expect(queueInitContainer.env?.find((entry) => entry.name === 'MAX_PARALLEL_BUILDS')?.value).toBe('2');
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
        expect(buildContainer.args).toEqual(expect.arrayContaining([
            expect.stringContaining('"name=registry-svc.registry-and-build.svc.cluster.local:5000/app-1:latest,registry-svc.registry-and-build.svc.cluster.local:5000/app-1:abc123"'),
        ]));
        expect(buildContainer.args).not.toContain('context=https://github.com/example/repo.git#refs/heads/main:./apps/web');
    });

    it('tags only the immutable commit tag when building a rollback', async () => {
        const job = await dockerfileBuildJobBuilder.buildJobDefinition({
            workload: {
                id: 'app-1',
                projectId: 'project-1',
                gitUrl: 'https://github.com/example/repo.git',
                gitBranch: 'main',
                dockerfilePath: './Dockerfile',
            } as any,
            workloadType: 'app',
            buildName: 'build-1',
            deploymentId: 'deployment-1',
            latestRemoteGitHash: 'abc123',
            latestRemoteGitCommitMessage: 'old commit',
            queuedAt: '123',
            maxParallelBuilds: 2,
            isRollback: true,
        });

        expect(job.metadata?.annotations?.['qs-is-rollback']).toBe('true');
        expect(job.spec?.template?.metadata?.annotations?.['qs-is-rollback']).toBe('true');
        const imageOutputArg = job.spec?.template?.spec?.containers[0]?.args?.find((arg) => arg.includes('type=image'));
        expect(imageOutputArg).toContain('registry-svc.registry-and-build.svc.cluster.local:5000/app-1:abc123');
        expect(imageOutputArg).not.toContain(':latest');
    });

    it('adds an SSH key secret volume when provided', async () => {
        const job = await dockerfileBuildJobBuilder.buildJobDefinition({
            workload: {
                id: 'app-1',
                projectId: 'project-1',
                sourceType: 'GIT_SSH',
                gitUrl: 'git@github.com:example/repo.git',
                gitBranch: 'main',
                dockerfilePath: './Dockerfile',
            } as any,
            workloadType: 'app',
            buildName: 'build-1',
            deploymentId: 'deployment-1',
            latestRemoteGitHash: 'abc123',
            latestRemoteGitCommitMessage: 'feat: test',
            queuedAt: '123',
            maxParallelBuilds: 2,
            gitSshPrivateKeySecretName: 'git-ssh-build-1',
        });

        expect(job.metadata?.annotations?.['qs-git-ssh-secret']).toBe('git-ssh-build-1');
        expect(job.spec?.template?.spec?.volumes).toEqual(expect.arrayContaining([
            {
                name: 'build-git-ssh-key',
                secret: {
                    secretName: 'git-ssh-build-1',
                    defaultMode: 0o400,
                },
            },
        ]));
    });
});
