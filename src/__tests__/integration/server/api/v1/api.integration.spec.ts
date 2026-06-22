// @vitest-environment node

import mockNextJsCaching from '@/__tests__/nextjs-cache.utils';
mockNextJsCaching();

vi.mock('@/server/adapter/kubernetes-api.adapter', () => ({ default: {} }));

import { GitTestRepositories } from '@/__tests__/git-test-repositories.utils';
import { createK3sTestContext } from '@/__tests__/k3s-test.utils';
import { mockPathUtilsForTests } from '@/__tests__/path-test.utils';
import { createPrismaTestContext } from '@/__tests__/prisma-test.utils';
import { v1Api } from '@/server/api/v1/api-index';
import restApiKeyService from '@/server/services/rest-api-key.service';
import userGroupService from '@/server/services/user-group.service';
import userService from '@/server/services/user.service';
import { PathUtils } from '@/server/utils/path.utils';
import { AppExtendedModel, AppExtendedWriteModel } from '@/shared/model/app-extended.model';
import { Project } from '@prisma/client';

describe('REST API v1 integration', () => {
    const ctx = createPrismaTestContext('rest-api-v1');
    const { originalInternalDataRoot, originalTempDataRoot } = mockPathUtilsForTests();
    const { deployRegistry } = createK3sTestContext(undefined);

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

    it('create, read, update and delete project through the api', async () => {
        const apiKey = await createAdminApiKey();

        // create
        const { createdProject, projectName } = await createApiProject(apiKey);

        // udpate
        const updatedProject = await expectApiJson(
            await apiFetch('/api/v1/projects', apiKey, {
                method: 'POST',
                body: { id: createdProject.id, name: `${projectName} Updated`, projectType: 'APP' },
            }),
        );
        expect(updatedProject).toMatchObject({
            id: createdProject.id,
            name: `${projectName} Updated`,
        });

        // read
        const fetchedProject = await expectApiJson(
            await apiFetch(`/api/v1/projects/${createdProject.id}`, apiKey),
        );
        expect(fetchedProject).toMatchObject({
            id: createdProject.id,
            name: `${projectName} Updated`,
        });

        // delete
        await expectApiJson(
            await apiFetch(`/api/v1/projects/${createdProject.id}`, apiKey, {
                method: 'DELETE',
            }),
        );

        // verify delete
        const allProjects = await expectApiJson(
            await apiFetch(`/api/v1/projects/`, apiKey),
        );
        expect(allProjects).toEqual(expect.not.arrayContaining([
            expect.objectContaining({
                id: createdProject.id,
            }),
        ]));

    }, 420_000);


    it('create, read, update and delete app through the api', async () => {
        const apiKey = await createAdminApiKey();

        // create
        const { project, app } = await createProjectAndGitApp(apiKey);

        // update
        app.name = 'API Dummy Node Updated';
        app.replicas = 2;
        const updatedApp = await expectApiJson(
            await apiFetch('/api/v1/apps', apiKey, {
                method: 'POST',
                body: app,
            }),
        );
        expect(updatedApp).toMatchObject({
            id: app.id,
            name: 'API Dummy Node Updated',
            replicas: 2,
        });

        // read
        const fetchedApp = await expectApiJson(
            await apiFetch(`/api/v1/apps/${app.id}`, apiKey),
        );
        expect(fetchedApp).toMatchObject({
            id: app.id,
            name: 'API Dummy Node Updated',
            projectId: project.id,
            sourceType: 'GIT',
            buildMethod: 'DOCKERFILE',
            gitUrl: GitTestRepositories.publicHttpsUrl,
        });

        // delete
        await expectApiJson(
            await apiFetch(`/api/v1/apps/${app.id}`, apiKey, {
                method: 'DELETE',
            }),
        );

        // verify delete
        const allApps = await expectApiJson(
            await apiFetch(`/api/v1/apps/`, apiKey),
        );
        expect(allApps).toEqual(expect.not.arrayContaining([
            expect.objectContaining({
                id: app.id,
            }),
        ]));

    }, 420_000);

    it('deploys an app and retrieves deployment details and logs through the api', async () => {
        const apiKey = await createAdminApiKey();
        await deployRegistry();

        // create
        const { app } = await createProjectAndGitApp(apiKey);

        // deploy
        const deployResponse = await expectApiJson(
            await apiFetch(`/api/v1/apps/${app.id}/deploy`, apiKey, { method: 'POST' }),
        );
        expect(deployResponse.deploymentId).toEqual(expect.any(String));

        // retrieve deployment details
        const deploymentDetails = await expectApiJson(
            await apiFetch(`/api/v1/apps/${app.id}/deploy/${deployResponse.deploymentId}`, apiKey),
        );
        expect(deploymentDetails).toMatchObject({
            appId: app.id,
            deploymentId: deployResponse.deploymentId,
            buildMethod: 'DOCKERFILE',
        });

        const deploymentList = await expectApiJson(
            await apiFetch(`/api/v1/apps/${app.id}/deploy`, apiKey),
        );
        expect(deploymentList).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    appId: app.id,
                    deploymentId: deployResponse.deploymentId,
                    status: expect.stringMatching(/^(PENDING|BUILDING|ERROR|DEPLOYED)$/),
                    buildMethod: 'DOCKERFILE',
                }),
            ]),
        );

        // retrieve deployment logs
        const deploymentLogs = await expectApiJson(
            await apiFetch(`/api/v1/apps/${app.id}/deploy/${deployResponse.deploymentId}/logs?tailLines=200`, apiKey),
        );
        expect(deploymentLogs).toMatchObject({
            appId: app.id,
            deplyomentId: deployResponse.deploymentId,
            tailLines: 200,
        });
        expect(deploymentLogs.logs).toContain('Selected build method: DOCKERFILE');
    }, 420_000);
});

async function createProjectAndGitApp(apiKey: string) {
    const { createdProject } = await createApiProject(apiKey);
    const createdApp = await createGitAppForProject(createdProject.id, apiKey);
    return { project: createdProject, app: createdApp };
}

async function createGitAppForProject(projectId: string, apiKey: string, appId?: string) {
    const app = createGitAppPayload(undefined, projectId, 'API Dummy Node');
    const createdApp = await expectApiJson(
        await apiFetch('/api/v1/apps', apiKey, {
            method: 'POST',
            body: app,
        })
    );
    expect(createdApp).toMatchObject({
        id: expect.stringContaining('api-dummy-node'),
        name: 'API Dummy Node',
        projectId: projectId,
        sourceType: 'GIT',
        buildMethod: 'DOCKERFILE',
        gitUrl: GitTestRepositories.publicHttpsUrl,
    });
    return createdApp as AppExtendedModel;
}

async function createApiProject(apiKey: string) {
    const suffix = Date.now();
    const projectName = `API Project ${suffix}`;

    const createdProject = await expectApiJson(
        await apiFetch('/api/v1/projects', apiKey, {
            method: 'POST',
            body: { name: projectName, projectType: 'APP' },
        })
    ) as Project;
    expect(createdProject.name).toBe(projectName);
    return { createdProject, projectName };
}

async function createAdminApiKey() {
    const adminRole = await userGroupService.getOrCreateAdminRole();
    const user = await userService.registerUser('admin-api-test@example.com', 'test-password', adminRole.id);
    return restApiKeyService.create(user.id, 'integration-test');
}

function createGitAppPayload(id: string | undefined, projectId: string, name: string): AppExtendedWriteModel {
    const retVal = {
        name,
        appType: 'APP',
        projectId,
        sourceType: 'GIT',
        buildMethod: 'DOCKERFILE',
        gitUrl: GitTestRepositories.publicHttpsUrl,
        gitBranch: GitTestRepositories.branch,
        dockerfilePath: './Dockerfile',
        replicas: 1,
        envVars: '',
        ingressNetworkPolicy: 'ALLOW_ALL',
        egressNetworkPolicy: 'ALLOW_ALL',
        useNetworkPolicy: true,
        healthCheckPeriodSeconds: 15,
        healthCheckTimeoutSeconds: 5,
        healthCheckFailureThreshold: 3,
        appDomains: [],
        appPorts: [{ port: 3000 }],
        appNodePorts: [],
        appFileMounts: [],
        appVolumes: [],
        appBasicAuths: [],
    };
    if (id) {
        return { ...retVal, id };
    }
    return retVal;
}

async function apiFetch(path: string, apiKey: string, init: { method?: string, body?: unknown } = {}) {
    return v1Api.fetch(new Request(`http://quickstack.test${path}`, {
        method: init.method ?? 'GET',
        headers: {
            authorization: `Bearer ${apiKey}`,
            ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
    }));
}

async function expectApiJson(response: Response) {
    const text = await response.text();
    const json = text ? JSON.parse(text) : undefined;

    expect(response.status, JSON.stringify(json)).toBeGreaterThanOrEqual(200);
    expect(response.status, JSON.stringify(json)).toBeLessThan(300);

    return json;
}
