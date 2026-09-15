import frameworkBuildJobBuilder from "./framework-build-job-builder.service";
import { RailpackBuildJobBuilderUtils } from "./railpack-build-job-builder.utils";
import { BUILD_SOURCE_PATH } from "./build-workspace.constants";

vi.mock('@/server/adapter/kubernetes-api.adapter', () => ({ default: {} }));

describe('FrameworkBuildJobBuilder', () => {
    it('builds a Railpack job with install, build, start and node version overrides', async () => {
        const job = await frameworkBuildJobBuilder.buildJobDefinition({
            workload: {
                id: 'app-1',
                projectId: 'project-1',
                sourceType: 'GIT',
                gitUrl: 'https://github.com/example/repo.git',
                gitBranch: 'main',
                framework: 'NEXTJS',
                installCommand: 'npm install',
                buildCommand: 'npm run build',
                runCommand: 'npm run start',
                rootDirectory: './',
                outputDirectory: '.next',
                nodeVersion: '22',
            } as any,
            workloadType: 'app',
            buildName: 'build-1',
            deploymentId: 'deployment-1',
            latestRemoteGitHash: 'abc123',
            latestRemoteGitCommitMessage: 'feat: test',
            queuedAt: '123',
            maxParallelBuilds: 2,
        });

        expect(job.metadata?.annotations?.['qs-build-method']).toBe('FRAMEWORK');
        const buildContainer = job.spec?.template?.spec?.containers[0]!;
        expect(buildContainer.args).toEqual(expect.arrayContaining([
            'context=/workspace/source',
            'dockerfile=/workspace/plan',
            '--secret',
            'id=RAILPACK_INSTALL_CMD,env=RAILPACK_INSTALL_CMD',
            'id=RAILPACK_BUILD_CMD,env=RAILPACK_BUILD_CMD',
            'id=RAILPACK_NODE_VERSION,env=RAILPACK_NODE_VERSION',
            'id=RAILPACK_START_CMD,env=RAILPACK_START_CMD',
        ]));
        expect(buildContainer.env).toEqual(expect.arrayContaining([
            { name: 'RAILPACK_INSTALL_CMD', value: 'npm install' },
            { name: 'RAILPACK_BUILD_CMD', value: 'npm run build' },
            { name: 'RAILPACK_NODE_VERSION', value: '22' },
            { name: 'RAILPACK_START_CMD', value: 'npm run start' },
        ]));

        const prepareScript = job.spec?.template?.spec?.initContainers
            ?.find((container) => container.name === 'railpack-prepare-init')?.args?.[0] ?? '';
        expect(prepareScript).toContain(`railpack prepare ${BUILD_SOURCE_PATH}`);
        expect(prepareScript).toContain(`--env 'RAILPACK_INSTALL_CMD=npm install'`);
        expect(prepareScript).toContain(`--env 'RAILPACK_BUILD_CMD=npm run build'`);
        expect(prepareScript).toContain(`--env 'RAILPACK_NODE_VERSION=22'`);
        expect(prepareScript).toContain(`--env 'RAILPACK_START_CMD=npm run start'`);
        expect(prepareScript).not.toContain('RAILPACK_SPA_OUTPUT_DIR');
    });

    it('uses the SPA output directory for a static framework without a run command', async () => {
        const job = await frameworkBuildJobBuilder.buildJobDefinition({
            workload: {
                id: 'app-1',
                projectId: 'project-1',
                sourceType: 'GIT',
                gitUrl: 'https://github.com/example/repo.git',
                gitBranch: 'main',
                framework: 'ASTRO',
                installCommand: 'npm install',
                buildCommand: 'astro build',
                runCommand: '',
                rootDirectory: 'apps/web',
                outputDirectory: 'dist',
            } as any,
            workloadType: 'app',
            buildName: 'build-1',
            deploymentId: 'deployment-1',
            latestRemoteGitHash: 'abc123',
            latestRemoteGitCommitMessage: 'feat: test',
            queuedAt: '123',
            maxParallelBuilds: 2,
        });

        const buildContainer = job.spec?.template?.spec?.containers[0]!;
        expect(buildContainer.args).toEqual(expect.arrayContaining([
            `context=${BUILD_SOURCE_PATH}/apps/web`,
            'id=RAILPACK_SPA_OUTPUT_DIR,env=RAILPACK_SPA_OUTPUT_DIR',
        ]));

        const prepareScript = job.spec?.template?.spec?.initContainers
            ?.find((container) => container.name === 'railpack-prepare-init')?.args?.[0] ?? '';
        expect(prepareScript).toContain(`railpack prepare ${BUILD_SOURCE_PATH}/apps/web`);
        expect(prepareScript).toContain(`--env 'RAILPACK_SPA_OUTPUT_DIR=dist'`);
        expect(prepareScript).not.toContain('RAILPACK_START_CMD');
    });
});

describe('Railpack override helpers', () => {
    it('resolves the source path for empty and nested root directories', () => {
        expect(RailpackBuildJobBuilderUtils.resolveAppDirectory(undefined)).toBe(BUILD_SOURCE_PATH);
        expect(RailpackBuildJobBuilderUtils.resolveAppDirectory('./')).toBe(BUILD_SOURCE_PATH);
        expect(RailpackBuildJobBuilderUtils.resolveAppDirectory('.')).toBe(BUILD_SOURCE_PATH);
        expect(RailpackBuildJobBuilderUtils.resolveAppDirectory('apps/web')).toBe(`${BUILD_SOURCE_PATH}/apps/web`);
        expect(RailpackBuildJobBuilderUtils.resolveAppDirectory('./apps/web/')).toBe(`${BUILD_SOURCE_PATH}/apps/web`);
    });

    it('shell-quotes command overrides containing single quotes', () => {
        const args = RailpackBuildJobBuilderUtils.getPrepareEnvArgs({ buildCommand: `echo 'hi'` });
        expect(args).toContain(`'RAILPACK_BUILD_CMD=echo '\\''hi'\\'''`);
    });
});
