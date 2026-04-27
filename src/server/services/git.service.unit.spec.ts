const gitMock = vi.hoisted(() => ({
    clone: vi.fn().mockResolvedValue('cloned'),
    checkout: vi.fn().mockResolvedValue('checked out'),
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

const { originalInternalDataRoot, originalTempDataRoot } = mockPathUtilsForTests();

describe('GitService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        gitMock.env.mockReturnValue(gitMock);
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
});
