import { appDockerfileDetectionZodModel, appSourceInfoGitSshZodModel, appSourceInfoGitZodModel, appSourceInfoInputZodModel } from "./app-source-info.model";

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

    it('requires a branch', () => {
        const result = appSourceInfoGitSshZodModel.safeParse({
            gitUrl: 'git@github.com:example/repo.git',
            gitBranch: '',
            buildMethod: 'RAILPACK',
        });

        expect(result.success).toBe(false);
    });
});

describe('appSourceInfoInputZodModel framework build method', () => {
    const gitInput = {
        sourceType: 'GIT' as const,
        gitUrl: 'https://github.com/example/repo.git',
        gitBranch: 'main',
        buildMethod: 'FRAMEWORK' as const,
    };

    it('requires a framework selection', () => {
        const result = appSourceInfoInputZodModel.safeParse({
            ...gitInput,
            buildCommand: 'next build',
        });

        expect(result.success).toBe(false);
    });

    it('requires a build command', () => {
        const result = appSourceInfoInputZodModel.safeParse({
            ...gitInput,
            framework: 'NEXTJS',
        });

        expect(result.success).toBe(false);
    });

    it('accepts a framework with commands and paths', () => {
        const result = appSourceInfoInputZodModel.safeParse({
            ...gitInput,
            framework: 'NEXTJS',
            installCommand: 'npm install',
            buildCommand: 'next build',
            runCommand: 'next start',
            rootDirectory: './',
            outputDirectory: '.next',
            nodeVersion: '22',
        });

        expect(result.success).toBe(true);
    });
});

describe('appDockerfileDetectionZodModel', () => {
    it('requires a selected Git branch before Dockerfile detection', () => {
        const result = appDockerfileDetectionZodModel.safeParse({
            sourceType: 'GIT',
            gitUrl: 'https://github.com/example/repo.git',
            gitBranch: '',
        });

        expect(result.success).toBe(false);
    });
});
