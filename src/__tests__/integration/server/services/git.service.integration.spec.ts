// @vitest-environment node

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { AppExtendedModel } from '@/shared/model/app-extended.model';
import { mockPathUtilsForTests } from '@/__tests__/path-test.utils';
import { GitTestRepositories, createGitApp, getPrivateGitSshKeyFromEnv } from '@/__tests__/git-test-repositories.utils';
import { PathUtils } from '@/server/utils/path.utils';

const sshKeyTempDirs: string[] = [];
const appGitSshKeyServiceMock = vi.hoisted(() => ({
    writePrivateKeyToTempFile: vi.fn(),
    cleanupTempKeyFile: vi.fn(),
}));

vi.mock('@/server/services/app-git-ssh-key.service', () => ({
    default: appGitSshKeyServiceMock,
}));

import gitService from '@/server/services/git.service';

const { originalInternalDataRoot, originalTempDataRoot } = mockPathUtilsForTests();

async function writePrivateKeyToTempFile(privateKey: string) {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'quickstack-git-service-key-'));
    sshKeyTempDirs.push(dir);
    const keyPath = path.join(dir, 'id_ed25519');
    await fs.writeFile(keyPath, `${privateKey}\n`, { mode: 0o600 });
    await fs.chmod(keyPath, 0o600);
    return keyPath;
}

async function expectRepositoryCloneWorks(app: AppExtendedModel) {
    await gitService.openGitContext(app, async (ctx) => {
        await expect(ctx.getLatestRemoteCommitHash()).resolves.toMatch(/^[0-9a-f]{40}$/);
        await expect(ctx.getLatestRemoteCommitMessage()).resolves.toEqual(expect.any(String));
    });
}

describe('git.service integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        appGitSshKeyServiceMock.writePrivateKeyToTempFile.mockResolvedValue(undefined);
        appGitSshKeyServiceMock.cleanupTempKeyFile.mockResolvedValue(undefined);
    });

    afterAll(async () => {
        if (originalInternalDataRoot) {
            Object.defineProperty(PathUtils, 'internalDataRoot', originalInternalDataRoot);
        }
        if (originalTempDataRoot) {
            Object.defineProperty(PathUtils, 'tempDataRoot', originalTempDataRoot);
        }
        await Promise.all(sshKeyTempDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })));
        vi.restoreAllMocks();
    });

    it('clones the public repository over HTTPS', async () => {
        await expectRepositoryCloneWorks(createGitApp({
            id: 'git-public-https',
            sourceType: 'GIT',
            gitUrl: GitTestRepositories.publicHttpsUrl,
        }));

        expect(appGitSshKeyServiceMock.writePrivateKeyToTempFile).not.toHaveBeenCalled();
    }, 120_000);

    it.skipIf(!getPrivateGitSshKeyFromEnv())(
        'clones the private repository over SSH with an app key',
        async () => {
            const privateKey = getPrivateGitSshKeyFromEnv()!;
            appGitSshKeyServiceMock.writePrivateKeyToTempFile.mockImplementation(() => writePrivateKeyToTempFile(privateKey));

            await expectRepositoryCloneWorks(createGitApp({
                id: 'git-private-ssh',
                sourceType: 'GIT_SSH',
                gitUrl: GitTestRepositories.privateSshUrl,
            }));

            expect(appGitSshKeyServiceMock.writePrivateKeyToTempFile).toHaveBeenCalledWith('git-private-ssh');
            expect(appGitSshKeyServiceMock.cleanupTempKeyFile).toHaveBeenCalledWith('git-private-ssh');
        },
        120_000,
    );
});
