import { appSourceInfoGitSshZodModel, appSourceInfoGitZodModel, appSourceInfoInputZodModel } from "./app-source-info.model";

describe('appSourceInfoGitZodModel', () => {
    const baseInput = {
        gitUrl: 'https://github.com/example/repo.git',
        gitBranch: 'main',
        gitUsername: undefined,
        gitToken: undefined,
    };

    it('allows Railpack builds without a dockerfile path', () => {
        const result = appSourceInfoGitZodModel.safeParse({
            ...baseInput,
            buildMethod: 'RAILPACK',
        });

        expect(result.success).toBe(true);
    });

    it('requires a dockerfile path for Dockerfile builds', () => {
        const result = appSourceInfoInputZodModel.safeParse({
            ...baseInput,
            sourceType: 'GIT',
            buildMethod: 'DOCKERFILE',
            dockerfilePath: '',
        });

        expect(result.success).toBe(false);
    });

    it('accepts a dockerfile path for Dockerfile builds', () => {
        const result = appSourceInfoGitZodModel.safeParse({
            ...baseInput,
            buildMethod: 'DOCKERFILE',
            dockerfilePath: './Dockerfile',
        });

        expect(result.success).toBe(true);
    });
});

describe('appSourceInfoGitSshZodModel', () => {
    it('accepts SCP-style SSH URLs', () => {
        const result = appSourceInfoGitSshZodModel.safeParse({
            gitUrl: 'git@github.com:example/repo.git',
            gitBranch: 'main',
            buildMethod: 'RAILPACK',
        });

        expect(result.success).toBe(true);
    });

    it('accepts ssh:// URLs', () => {
        const result = appSourceInfoGitSshZodModel.safeParse({
            gitUrl: 'ssh://git@gitlab.com/example/repo.git',
            gitBranch: 'main',
            buildMethod: 'RAILPACK',
        });

        expect(result.success).toBe(true);
    });

    it('rejects HTTPS URLs for SSH source type', () => {
        const result = appSourceInfoGitSshZodModel.safeParse({
            gitUrl: 'https://github.com/example/repo.git',
            gitBranch: 'main',
            buildMethod: 'RAILPACK',
        });

        expect(result.success).toBe(false);
    });
});
