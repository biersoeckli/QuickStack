import buildGitInitContainerService from "./build-git-init-container.service";

describe('BuildGitInitContainerService', () => {
    it('builds a git init container that clones into the shared workspace and pins the commit', () => {
        const container = buildGitInitContainerService.getInitContainer({
            app: {
                id: 'app-1',
                projectId: 'project-1',
                gitUrl: 'https://github.com/example/repo.git',
                gitBranch: 'main',
                gitUsername: 'user',
                gitToken: 'token',
            } as any,
            buildName: 'build-1',
            deploymentId: 'deployment-1',
            latestRemoteGitHash: 'abc123',
            latestRemoteGitCommitMessage: 'feat: test',
            queuedAt: '123',
        });

        expect(container.name).toBe('build-git-init');
        expect(container.image).toBe('alpine/git');
        expect(container.volumeMounts).toEqual([
            { name: 'build-workspace', mountPath: '/workspace' },
        ]);
        expect(container.env).toEqual(expect.arrayContaining([
            { name: 'GIT_URL', value: 'https://user:token@github.com/example/repo.git' },
            { name: 'GIT_BRANCH', value: 'main' },
            { name: 'GIT_COMMIT', value: 'abc123' },
            { name: 'SOURCE_PATH', value: '/workspace/source' },
        ]));

        const script = container.args?.[0] ?? '';
        expect(script).toContain('git clone --depth 1 --single-branch --branch "$GIT_BRANCH" "$GIT_URL" "$SOURCE_PATH"');
        expect(script).toContain('git cat-file -e "$GIT_COMMIT^{commit}"');
        expect(script).toContain('git fetch --depth 1 origin "$GIT_COMMIT"');
        expect(script).toContain('git checkout --detach "$GIT_COMMIT"');
    });

    it('mounts an SSH key secret and configures GIT_SSH_COMMAND for SSH auth', () => {
        const container = buildGitInitContainerService.getInitContainer({
            app: {
                id: 'app-1',
                projectId: 'project-1',
                sourceType: 'GIT_SSH',
                gitUrl: 'git@github.com:example/repo.git',
                gitBranch: 'main',
                gitUsername: 'user',
                gitToken: 'token',
            } as any,
            buildName: 'build-1',
            deploymentId: 'deployment-1',
            latestRemoteGitHash: 'abc123',
            latestRemoteGitCommitMessage: 'feat: test',
            queuedAt: '123',
            gitSshPrivateKeySecretName: 'git-ssh-build-1',
        });

        expect(container.env).toEqual(expect.arrayContaining([
            { name: 'GIT_URL', value: 'git@github.com:example/repo.git' },
            {
                name: 'GIT_SSH_COMMAND',
                value: 'ssh -i /git-ssh-key/ssh-privatekey -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null',
            },
        ]));
        expect(container.env).not.toEqual(expect.arrayContaining([
            { name: 'GIT_URL', value: 'https://user:token@github.com/example/repo.git' },
        ]));
        expect(container.volumeMounts).toEqual(expect.arrayContaining([
            { name: 'build-git-ssh-key', mountPath: '/git-ssh-key', readOnly: true },
        ]));

        const script = container.args?.[0] ?? '';
        expect(script).toContain('git clone --depth 1 --single-branch --branch "$GIT_BRANCH" "$GIT_URL" "$SOURCE_PATH"');
    });
});
