const gitMock = vi.hoisted(() => ({
    clone: vi.fn().mockResolvedValue('cloned'),
    checkout: vi.fn().mockResolvedValue('checked out'),
    listRemote: vi.fn(),
    env: vi.fn(),
}));

vi.mock('simple-git', () => ({
    default: vi.fn(() => gitMock),
}));

vi.mock('@/server/services/app-git-ssh-key.service', () => ({
    default: {
        writePrivateKeyToTempFile: vi.fn(),
        cleanupTempKeyFile: vi.fn(),
    },
}));

import gitService from './git.service';
import appGitSshKeyService from './app-git-ssh-key.service';
import { PathUtils } from '../utils/path.utils';
import { mockPathUtilsForTests } from '@/__tests__/path-test.utils';
import { ServiceException } from '@/shared/model/service.exception.model';
import fs from 'fs';
import path from 'path';
import { createPrismaTestContext } from '@/__tests__/prisma-test.utils';

const { originalInternalDataRoot, originalTempDataRoot } = mockPathUtilsForTests();

describe('GitService', () => {
    createPrismaTestContext('git-service');
    beforeEach(() => {
        vi.clearAllMocks();
        gitMock.env.mockReturnValue(gitMock);
        gitMock.listRemote.mockResolvedValue('');
    });

    afterAll(() => {
        if (originalInternalDataRoot) {
            Object.defineProperty(PathUtils, 'internalDataRoot', originalInternalDataRoot);
        }
        if (originalTempDataRoot) {
            Object.defineProperty(PathUtils, 'tempDataRoot', originalTempDataRoot);
        }
        vi.restoreAllMocks();
    });

    it('keeps HTTPS token authentication for GIT apps', async () => {
        await gitService.openGitContext({
            id: 'app-1',
            sourceType: 'GIT',
            gitUrl: 'https://github.com/biersoeckli/dummy-node-app.git',
            gitUsername: 'user',
            gitToken: 'token',
            gitBranch: 'main',
        } as any, async () => undefined);

        expect(gitMock.clone).toHaveBeenCalledWith('https://user:token@github.com/biersoeckli/dummy-node-app.git', expect.any(String));
        expect(gitMock.env).not.toHaveBeenCalled();
    });

    it('sets GIT_SSH_COMMAND for GIT_SSH apps with generated key', async () => {
        vi.mocked(appGitSshKeyService.writePrivateKeyToTempFile).mockResolvedValue('/tmp/id_ed25519');

        await gitService.openGitContext({
            id: 'app-1',
            sourceType: 'GIT_SSH',
            gitUrl: 'git@github.com:biersoeckli/dummy-node-app.git',
            gitUsername: 'user',
            gitToken: 'token',
            gitBranch: 'main',
        } as any, async () => undefined);

        expect(gitMock.clone).toHaveBeenCalledWith('git@github.com:biersoeckli/dummy-node-app.git', expect.any(String));
        expect(gitMock.env).toHaveBeenCalledWith(
            'GIT_SSH_COMMAND',
            'ssh -i /tmp/id_ed25519 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null',
        );
    });

    it('uses plain SSH when GIT_SSH app has no generated key', async () => {
        vi.mocked(appGitSshKeyService.writePrivateKeyToTempFile).mockResolvedValue(undefined);

        await gitService.openGitContext({
            id: 'app-1',
            sourceType: 'GIT_SSH',
            gitUrl: 'git@github.com:biersoeckli/dummy-node-app.git',
            gitBranch: 'main',
        } as any, async () => undefined);

        expect(gitMock.clone).toHaveBeenCalledWith('git@github.com:biersoeckli/dummy-node-app.git', expect.any(String));
        expect(gitMock.env).not.toHaveBeenCalled();
    });

    it('lists remote branches with the default branch first and common branches prioritized', async () => {
        gitMock.listRemote.mockResolvedValue([
            'ref: refs/heads/develop\tHEAD',
            '1111111111111111111111111111111111111111\tHEAD',
            '2222222222222222222222222222222222222222\trefs/heads/z-feature',
            '3333333333333333333333333333333333333333\trefs/heads/main',
            '4444444444444444444444444444444444444444\trefs/heads/develop',
            '5555555555555555555555555555555555555555\trefs/heads/master',
            '6666666666666666666666666666666666666666\trefs/heads/a-feature',
        ].join('\n'));

        await expect(gitService.listRemoteBranches({
            id: 'app-1',
            sourceType: 'GIT',
            gitUrl: 'https://github.com/biersoeckli/dummy-node-app.git',
        })).resolves.toEqual(['develop', 'main', 'master', 'a-feature', 'z-feature']);
    });

    it('uses typed HTTPS credentials only for the remote branch lookup', async () => {
        gitMock.listRemote.mockResolvedValue('1111111111111111111111111111111111111111\trefs/heads/main');

        await gitService.listRemoteBranches({
            id: 'app-1',
            sourceType: 'GIT',
            gitUrl: 'https://github.com/biersoeckli/dummy-node-app.git',
            gitUsername: 'user',
            gitToken: 'token',
        });

        expect(gitMock.listRemote).toHaveBeenCalledWith([
            '--symref',
            'https://user:token@github.com/biersoeckli/dummy-node-app.git',
            'HEAD',
            'refs/heads/*',
        ]);
        expect(gitMock.env).not.toHaveBeenCalled();
    });

    it('uses and cleans up the app SSH key for SSH remote branch lookup', async () => {
        vi.mocked(appGitSshKeyService.writePrivateKeyToTempFile).mockResolvedValue('/tmp/id_ed25519');
        gitMock.listRemote.mockResolvedValue('1111111111111111111111111111111111111111\trefs/heads/main');

        await gitService.listRemoteBranches({
            id: 'app-1',
            sourceType: 'GIT_SSH',
            gitUrl: 'git@github.com:biersoeckli/dummy-node-app.git',
        });

        expect(gitMock.env).toHaveBeenCalledWith(
            'GIT_SSH_COMMAND',
            'ssh -i /tmp/id_ed25519 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null',
        );
        expect(gitMock.listRemote).toHaveBeenCalledWith([
            '--symref',
            'git@github.com:biersoeckli/dummy-node-app.git',
            'HEAD',
            'refs/heads/*',
        ]);
        expect(appGitSshKeyService.cleanupTempKeyFile).toHaveBeenCalledWith('app-1');
    });

    it('maps remote branch lookup git failures to service errors', async () => {
        gitMock.listRemote.mockRejectedValue(new Error('Repository not found'));

        await expect(gitService.listRemoteBranches({
            id: 'app-1',
            sourceType: 'GIT',
            gitUrl: 'https://github.com/biersoeckli/missing.git',
        })).rejects.toThrow(ServiceException);
        await expect(gitService.listRemoteBranches({
            id: 'app-1',
            sourceType: 'GIT',
            gitUrl: 'https://github.com/biersoeckli/missing.git',
        })).rejects.toThrow('Git repository not found. Please check the repository URL.');
    });

    it('detects a root Dockerfile for a Git source', async () => {
        gitMock.clone.mockImplementation(async (_url: string, repoPath: string) => {
            await fs.promises.mkdir(repoPath, { recursive: true });
            await fs.promises.writeFile(path.join(repoPath, 'Dockerfile'), 'FROM node:22-alpine');
            return 'cloned';
        });

        await expect(gitService.detectDockerfilePath({
            id: 'app-1',
            sourceType: 'GIT',
            gitUrl: 'https://github.com/biersoeckli/dummy-node-app.git',
            gitBranch: 'main',
        })).resolves.toBe('./Dockerfile');
    });

    it('detects the shortest nested Dockerfile when the repo root has none', async () => {
        gitMock.clone.mockImplementation(async (_url: string, repoPath: string) => {
            await fs.promises.mkdir(path.join(repoPath, 'zeta'), { recursive: true });
            await fs.promises.mkdir(path.join(repoPath, 'api'), { recursive: true });
            await fs.promises.writeFile(path.join(repoPath, 'zeta', 'Dockerfile'), 'FROM node:22-alpine');
            await fs.promises.writeFile(path.join(repoPath, 'api', 'Dockerfile'), 'FROM node:22-alpine');
            return 'cloned';
        });

        await expect(gitService.detectDockerfilePath({
            id: 'app-1',
            sourceType: 'GIT',
            gitUrl: 'https://github.com/biersoeckli/dummy-node-app.git',
            gitBranch: 'main',
        })).resolves.toBe('./api/Dockerfile');
    });

    it('falls back to the default Dockerfile path when none exists', async () => {
        gitMock.clone.mockImplementation(async (_url: string, repoPath: string) => {
            await fs.promises.mkdir(path.join(repoPath, 'src'), { recursive: true });
            await fs.promises.writeFile(path.join(repoPath, 'src', 'index.ts'), 'export {};');
            return 'cloned';
        });

        await expect(gitService.detectDockerfilePath({
            id: 'app-1',
            sourceType: 'GIT',
            gitUrl: 'https://github.com/biersoeckli/dummy-node-app.git',
            gitBranch: 'main',
        })).resolves.toBe('./Dockerfile');
    });
});
