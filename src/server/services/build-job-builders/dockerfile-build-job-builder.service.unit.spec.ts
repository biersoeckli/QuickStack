import dockerfileBuildJobBuilder from "./dockerfile-build-job-builder.service";

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
        expect(job.spec?.template?.spec?.initContainers).toHaveLength(1);
        expect(job.spec?.template?.spec?.containers[0].command).toEqual(['buildctl-daemonless.sh']);
        expect(job.spec?.template?.spec?.containers[0].args).toEqual(expect.arrayContaining([
            'dockerfile.v0',
            'filename=Dockerfile',
            'context=https://github.com/example/repo.git#refs/heads/main:./apps/web',
        ]));
    });
});
