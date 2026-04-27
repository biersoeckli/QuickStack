// @vitest-environment node

import mockNextJsCaching from '@/__tests__/nextjs-cache.utils';
mockNextJsCaching();

vi.mock('@/server/adapter/kubernetes-api.adapter', () => ({ default: {} }));

import { getPrivateGitSshKeyFromEnv, GitTestRepositories } from '@/__tests__/git-test-repositories.utils';
import { createK3sTestContext } from '@/__tests__/k3s-test.utils';
import { mockPathUtilsForTests } from '@/__tests__/path-test.utils';
import { createPrismaTestContext } from '@/__tests__/prisma-test.utils';
import dataAccess from '@/server/adapter/db.client';
import k3s from '@/server/adapter/kubernetes-api.adapter';
import buildService from '@/server/services/build.service';
import deploymentLogService from '@/server/services/deployment-logs.service';
import paramService, { ParamService } from '@/server/services/param.service';
import podService from '@/server/services/pod.service';
import registryService, { BUILD_NAMESPACE } from '@/server/services/registry.service';
import { CryptoUtils } from '@/server/utils/crypto.utils';
import { PathUtils } from '@/server/utils/path.utils';
import { AppExtendedModel } from '@/shared/model/app-extended.model';
import { AppBuildMethod } from '@/shared/model/app-source-info.model';
import { Constants } from '@/shared/utils/constants';
import fs from 'node:fs/promises';


describe('build.service integration', () => {
    setupBuildServiceIntegration('build-service');

    it('fails to build a docker image from an SSH repository without ssh key auth', async () => {
        await runBuildAndAssertGitFailure({
            appIdPrefix: 'dockerfile-ssh-public',
            projectIdPrefix: 'proj-dockerfile-ssh-public',
            sourceType: 'GIT_SSH',
            buildMethod: 'DOCKERFILE',
            gitUrl: GitTestRepositories.publicSshUrl,
            expectedLogLine: 'Dockerfile path: ./Dockerfile',
        });
    }, 420_000);

    it.skipIf(!getPrivateGitSshKeyFromEnv())('builds and pushes a docker image from the private SSH repository', async () => {
        await runBuildAndAssert({
            appIdPrefix: 'dockerfile-ssh-private',
            projectIdPrefix: 'proj-dockerfile-ssh-private',
            sourceType: 'GIT_SSH',
            buildMethod: 'DOCKERFILE',
            gitUrl: GitTestRepositories.privateSshUrl,
            expectedLogLine: 'Dockerfile path: ./Dockerfile',
            privateSshKey: getRequiredPrivateGitSshKey(),
        });
    }, 420_000);

    it.skipIf(!getPrivateGitSshKeyFromEnv())('builds and pushes a railpack image from the private SSH repository', async () => {
        await runBuildAndAssert({
            appIdPrefix: 'railpack-ssh-private',
            projectIdPrefix: 'proj-railpack-ssh-private',
            sourceType: 'GIT_SSH',
            buildMethod: 'RAILPACK',
            gitUrl: GitTestRepositories.privateSshUrl,
            expectedLogLine: 'Railpack build will run queue wait, prepare step, and BuildKit build in sequence.',
            privateSshKey: getRequiredPrivateGitSshKey(),
        });
    }, 420_000);


    it('builds and pushes a docker image from the public HTTPS repository', async () => {
        await runBuildAndAssert({
            appIdPrefix: 'dockerfile-http',
            projectIdPrefix: 'proj-dockerfile-http',
            sourceType: 'GIT',
            buildMethod: 'DOCKERFILE',
            gitUrl: GitTestRepositories.publicHttpsUrl,
            expectedLogLine: 'Dockerfile path: ./Dockerfile',
        });
    }, 420_000);

    it('builds and pushes a railpack image from the public HTTPS repository', async () => {
        await runBuildAndAssert({
            appIdPrefix: 'railpack-http',
            projectIdPrefix: 'proj-railpack-http',
            sourceType: 'GIT',
            buildMethod: 'RAILPACK',
            gitUrl: GitTestRepositories.publicHttpsUrl,
            expectedLogLine: 'Railpack build will run queue wait, prepare step, and BuildKit build in sequence.',
        });
    }, 420_000);
});

export type BuildIntegrationInput = {
    appIdPrefix: string;
    projectIdPrefix: string;
    buildMethod: AppBuildMethod;
    sourceType: 'GIT' | 'GIT_SSH';
    gitUrl: string;
    expectedLogLine: string;
    privateSshKey?: string;
};

export function setupBuildServiceIntegration(label: string) {
    const { originalInternalDataRoot, originalTempDataRoot } = mockPathUtilsForTests();
    createK3sTestContext();
    createPrismaTestContext(label);

    beforeEach(() => {
        process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET ?? 'test-nextauth-secret';
        vi.clearAllMocks();
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
}

export async function deployRegistryForBuildIntegration() {
    await paramService.save({
        name: ParamService.BUILD_NODE,
        value: Constants.BUILD_NODE_K3S_NATIVE_VALUE,
    });

    await registryService.deployRegistry(Constants.INTERNAL_REGISTRY_LOCATION, true);

    await expect.poll(async () => {
        const pods = await podService.getPodsForApp(BUILD_NAMESPACE, 'registry');
        if (pods.length !== 1) {
            return 'MISSING';
        }

        const pod = await k3s.core.readNamespacedPod(pods[0].podName, BUILD_NAMESPACE);
        return pod.body.status?.phase ?? 'UNKNOWN';
    }, {
        timeout: 120_000,
        interval: 2_000,
    }).toBe('Running');

    const registryDeployments = await k3s.apps.listNamespacedDeployment(BUILD_NAMESPACE);
    expect(registryDeployments.body.items.some((item) => item.metadata?.name === 'registry')).toBe(true);
}

export async function runBuildAndAssert(input: BuildIntegrationInput) {
    await deployRegistryForBuildIntegration();

    const suffix = Date.now();
    const app = createBuildApp({
        ...input,
        id: `${input.appIdPrefix}-${suffix}`,
        projectId: `${input.projectIdPrefix}-${suffix}`,
    });

    if (input.privateSshKey) {
        await persistAppAndSshKey(app, input.privateSshKey);
    }

    const deploymentId = `dep-${suffix}`;
    const [buildJobName, gitCommitHash, gitCommitMessage, shouldDeployImmediately] =
        await deploymentLogService.catchErrosAndLog(deploymentId, async () => buildService.buildApp(deploymentId, app, true));

    expect(shouldDeployImmediately).toBe(false);
    expect(buildJobName).toMatch(new RegExp(`^build-${app.id}`));
    expect(gitCommitHash).toMatch(/^[0-9a-f]{40}$/);
    expect(gitCommitMessage.length).toBeGreaterThan(0);

    await expect.poll(async () => {
        return await buildService.getJobStatus(buildJobName);
    }, {
        timeout: 300_000,
        interval: 2_000,
    }).toBe('SUCCEEDED');

    const registryPods = await podService.getPodsForApp(BUILD_NAMESPACE, 'registry');
    expect(registryPods).toHaveLength(1);

    await podService.runCommandInPod(
        BUILD_NAMESPACE,
        registryPods[0].podName,
        registryPods[0].containerName,
        [
            'sh',
            '-c',
            `test -f /var/lib/registry/docker/registry/v2/repositories/${app.id}/_manifests/tags/latest/current/link`,
        ],
    );

    const builds = await buildService.getBuildsForApp(app.id);
    expect(builds[0]).toMatchObject({
        name: buildJobName,
        status: 'SUCCEEDED',
        buildMethod: input.buildMethod,
        gitCommit: gitCommitHash,
    });

    const logFile = await fs.readFile(PathUtils.appDeploymentLogFile(deploymentId), 'utf-8');
    expect(logFile).toContain(`Selected build method: ${input.buildMethod}`);
    expect(logFile).toContain(input.expectedLogLine);
    expect(logFile).toContain(`Build job ${buildJobName} scheduled successfully`);
}

export async function runBuildAndAssertGitFailure(input: BuildIntegrationInput) {
    await deployRegistryForBuildIntegration();

    const suffix = Date.now();
    const app = createBuildApp({
        ...input,
        id: `${input.appIdPrefix}-${suffix}`,
        projectId: `${input.projectIdPrefix}-${suffix}`,
    });

    const deploymentId = `dep-${suffix}`;
    await expect(deploymentLogService.catchErrosAndLog(deploymentId, async () => buildService.buildApp(deploymentId, app, true)))
        .rejects
        .toThrow('Git: SSH host key verification failed.');

    const builds = await buildService.getBuildsForApp(app.id);
    expect(builds).toHaveLength(0);
}

export function getRequiredPrivateGitSshKey() {
    const privateSshKey = getPrivateGitSshKeyFromEnv();
    if (!privateSshKey) {
        throw new Error('Missing private SSH key for integration test.');
    }
    return privateSshKey;
}

function createBuildApp(input: BuildIntegrationInput & { id: string; projectId: string }): AppExtendedModel {
    return {
        id: input.id,
        name: input.id,
        appType: 'APP',
        projectId: input.projectId,
        sourceType: input.sourceType,
        buildMethod: input.buildMethod,
        dockerfilePath: './Dockerfile',
        gitUrl: input.gitUrl,
        gitBranch: GitTestRepositories.branch,
        replicas: 1,
        envVars: '',
        ingressNetworkPolicy: 'ALLOW_ALL',
        egressNetworkPolicy: 'ALLOW_ALL',
        useNetworkPolicy: true,
        healthCheckPeriodSeconds: 15,
        healthCheckTimeoutSeconds: 5,
        healthCheckFailureThreshold: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
        project: {
            id: input.projectId,
            name: input.projectId,
            createdAt: new Date(),
            updatedAt: new Date(),
        },
        appDomains: [],
        appPorts: [],
        appFileMounts: [],
        appVolumes: [],
        appBasicAuths: [],
    };
}

async function persistAppAndSshKey(app: AppExtendedModel, privateSshKey: string) {
    await dataAccess.client.project.create({
        data: {
            id: app.projectId,
            name: app.project.name,
        },
    });
    await dataAccess.client.app.create({
        data: {
            id: app.id,
            name: app.name,
            appType: app.appType,
            projectId: app.projectId,
            sourceType: app.sourceType,
            buildMethod: app.buildMethod,
            gitUrl: app.gitUrl,
            gitBranch: app.gitBranch,
            dockerfilePath: app.dockerfilePath,
            replicas: app.replicas,
            envVars: app.envVars,
            ingressNetworkPolicy: app.ingressNetworkPolicy,
            egressNetworkPolicy: app.egressNetworkPolicy,
            useNetworkPolicy: app.useNetworkPolicy,
            healthCheckPeriodSeconds: app.healthCheckPeriodSeconds,
            healthCheckTimeoutSeconds: app.healthCheckTimeoutSeconds,
            healthCheckFailureThreshold: app.healthCheckFailureThreshold,
        },
    });
    await dataAccess.client.appGitSshKey.create({
        data: {
            appId: app.id,
            publicKey: 'ssh-ed25519 integration-test-placeholder',
            encryptedPrivateKey: CryptoUtils.encrypt(privateSshKey),
        },
    });
}
