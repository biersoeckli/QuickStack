// @vitest-environment node

import mockNextJsCaching from '@/__tests__/nextjs-cache.utils';
mockNextJsCaching();

vi.mock('@/server/adapter/kubernetes-api.adapter', () => ({ default: {} }));

import path from 'node:path';
import fs from 'node:fs/promises';
import { createK3sTestContext } from '@/__tests__/k3s-test.utils';
import buildService from '@/server/services/build.service';
import deploymentLogService from '@/server/services/deployment-logs.service';
import paramService, { ParamService } from '@/server/services/param.service';
import podService from '@/server/services/pod.service';
import registryService, { BUILD_NAMESPACE } from '@/server/services/registry.service';
import k3s from '@/server/adapter/kubernetes-api.adapter';
import { AppExtendedModel } from '@/shared/model/app-extended.model';
import { Constants } from '@/shared/utils/constants';
import { PathUtils } from '@/server/utils/path.utils';
import { createPrismaTestContext } from '@/__tests__/prisma-test.utils';

const testStorageRoot = path.join(process.cwd(), 'storage');
const originalInternalDataRoot = Object.getOwnPropertyDescriptor(PathUtils, 'internalDataRoot');
const originalTempDataRoot = Object.getOwnPropertyDescriptor(PathUtils, 'tempDataRoot');

Object.defineProperty(PathUtils, 'internalDataRoot', {
    configurable: true,
    get: () => path.join(testStorageRoot, 'internal'),
});

Object.defineProperty(PathUtils, 'tempDataRoot', {
    configurable: true,
    get: () => path.join(testStorageRoot, 'tmp'),
});

async function deployRegistry() {
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

describe('build.service integration', () => {
    createK3sTestContext();
    createPrismaTestContext('build-service-integration');

    afterAll(() => {
        if (originalInternalDataRoot) {
            Object.defineProperty(PathUtils, 'internalDataRoot', originalInternalDataRoot);
        }
        if (originalTempDataRoot) {
            Object.defineProperty(PathUtils, 'tempDataRoot', originalTempDataRoot);
        }
        vi.restoreAllMocks();
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('builds and pushes a railpack image for the dummy node app repository', async () => {

        await deployRegistry();

        const suffix = Date.now();
        const app: AppExtendedModel = {
            id: `railpack-dummy-${suffix}`,
            name: `railpack-dummy-${suffix}`,
            appType: 'APP',
            projectId: `proj-railpack-${suffix}`,
            sourceType: 'GIT',
            buildMethod: 'RAILPACK',
            dockerfilePath: './Dockerfile',
            gitUrl: 'https://github.com/biersoeckli/dummy-node-app.git',
            gitBranch: 'main',
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
                id: `proj-railpack-${suffix}`,
                name: `Railpack Build Project ${suffix}`,
                createdAt: new Date(),
                updatedAt: new Date(),
            },
            appDomains: [],
            appPorts: [],
            appFileMounts: [],
            appVolumes: [],
            appBasicAuths: [],
        };


        const deploymentId = `dep-${Date.now()}`;
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
            buildMethod: 'RAILPACK',
            gitCommit: gitCommitHash,
        });

        const logFile = await fs.readFile(PathUtils.appDeploymentLogFile(deploymentId), 'utf-8');
        expect(logFile).toContain('Selected build method: RAILPACK');
        expect(logFile).toContain(`Build job ${buildJobName} scheduled successfully`);
    }, 420_000);

    it('builds and pushes a docker image frma dockerfile using the dummy node app repository', async () => {

        await deployRegistry();

        const suffix = Date.now();
        const app: AppExtendedModel = {
            id: `dockerfile-dummy-${suffix}`,
            name: `dockerfile-dummy-${suffix}`,
            appType: 'APP',
            projectId: `proj-dockerfile-${suffix}`,
            sourceType: 'GIT',
            buildMethod: 'DOCKERFILE',
            dockerfilePath: './Dockerfile',
            gitUrl: 'https://github.com/biersoeckli/dummy-node-app.git',
            gitBranch: 'main',
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
                id: `proj-dockerfile-${suffix}`,
                name: `Dockerfile Build Project ${suffix}`,
                createdAt: new Date(),
                updatedAt: new Date(),
            },
            appDomains: [],
            appPorts: [],
            appFileMounts: [],
            appVolumes: [],
            appBasicAuths: [],
        };


        const deploymentId = `dep-${Date.now()}`;
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
            buildMethod: 'DOCKERFILE',
            gitCommit: gitCommitHash,
        });

        const logFile = await fs.readFile(PathUtils.appDeploymentLogFile(deploymentId), 'utf-8');
        expect(logFile).toContain('Selected build method: DOCKERFILE');
        expect(logFile).toContain(`Build job ${buildJobName} scheduled successfully`);
    }, 420_000);
});
