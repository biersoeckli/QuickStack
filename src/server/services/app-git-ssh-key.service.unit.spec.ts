const dbMock = vi.hoisted(() => ({
    upsert: vi.fn(),
    findUnique: vi.fn(),
}));

vi.mock('next/cache', () => ({
    revalidateTag: vi.fn(),
}));

vi.mock('@/server/adapter/db.client', () => ({
    default: {
        client: {
            appGitSshKey: dbMock,
        },
    },
}));

vi.mock('@/server/services/secret.service', () => ({
    default: {
        saveSecret: vi.fn(),
        deleteSecretIfExists: vi.fn(),
    },
}));

vi.mock('@/server/services/registry.service', () => ({
    BUILD_NAMESPACE: 'qs-build',
}));

import { mockPathUtilsForTests } from '@/__tests__/path-test.utils';
import { CryptoUtils } from '../utils/crypto.utils';
import { PathUtils } from '../utils/path.utils';
import appGitSshKeyService from './app-git-ssh-key.service';

const { originalInternalDataRoot, originalTempDataRoot } = mockPathUtilsForTests();

describe('AppGitSshKeyService', () => {
    beforeEach(() => {
        process.env.NEXTAUTH_SECRET = 'test-secret';
        vi.clearAllMocks();
        dbMock.upsert.mockImplementation(async ({ create, update }) => ({
            id: 'key-1',
            ...create,
            ...update,
        }));
    });

    afterAll(async () => {
        if (originalInternalDataRoot) {
            Object.defineProperty(PathUtils, 'internalDataRoot', originalInternalDataRoot);
        }
        if (originalTempDataRoot) {
            Object.defineProperty(PathUtils, 'tempDataRoot', originalTempDataRoot);
        }
        vi.restoreAllMocks();
    });


    it('generates an Ed25519 public key and stores only encrypted private key data', async () => {
        const publicKey = await appGitSshKeyService.generateOrRegenerate('app-1');
        const saved = dbMock.upsert.mock.calls[0][0].create;

        expect(publicKey).toMatch(/^ssh-ed25519 /);
        expect(saved.publicKey).toBe(publicKey);
        expect(saved.encryptedPrivateKey).not.toContain('OPENSSH PRIVATE KEY');
        expect(CryptoUtils.decrypt(saved.encryptedPrivateKey)).toContain('OPENSSH PRIVATE KEY');
    });

    it('replaces key material on regeneration', async () => {
        const firstPublicKey = await appGitSshKeyService.generateOrRegenerate('app-1');
        const secondPublicKey = await appGitSshKeyService.generateOrRegenerate('app-1');

        expect(dbMock.upsert).toHaveBeenCalledTimes(2);
        expect(secondPublicKey).toMatch(/^ssh-ed25519 /);
        expect(secondPublicKey).not.toBe(firstPublicKey);
    });
});
