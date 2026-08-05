// @vitest-environment node

import mockNextJsCaching from '@/__tests__/nextjs-cache.utils';
mockNextJsCaching();

vi.mock('@/server/adapter/kubernetes-api.adapter', () => ({ default: {} }));

import { GitTestRepositories } from '@/__tests__/git-test-repositories.utils';
import { createK3sTestContext } from '@/__tests__/k3s-test.utils';
import { mockPathUtilsForTests } from '@/__tests__/path-test.utils';
import { createPrismaTestContext } from '@/__tests__/prisma-test.utils';
import { v1Api } from '@/server/api/v1/api-index';
import dataAccess from '@/server/adapter/db.client';
import agentAccessService from '@/server/services/agent-access.service';
import agentService from '@/server/services/agent.service';
import restApiKeyService from '@/server/services/rest-api-key.service';
import userGroupService from '@/server/services/user-group.service';
import userService from '@/server/services/user.service';
import { PathUtils } from '@/server/utils/path.utils';
import { AgentExtendedModel, AgentExtendedWriteModel } from '@/shared/model/agent-extended.model';
import { AppExtendedModel, AppExtendedWriteModel } from '@/shared/model/app-extended.model';
import { Project } from '@prisma/client';

describe('REST API v1 integration', () => {
    createPrismaTestContext('rest-api-v1');
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

    it('create, read, update and delete agent through the api', async () => {
        const apiKey = await createAdminApiKey();

        const { createdProject } = await createApiProject(apiKey, 'AGENT');
        const gateway = await dataAccess.client.llmGateway.create({
            data: {
                name: 'API Test Gateway',
                baseUrl: 'https://litellm.example.com',
                encryptedAdminKey: 'encrypted:test-key',
            },
        });

        const agent = createAgentPayload(undefined, createdProject.id, gateway.id, 'API Test Agent');
        const createdAgent = await expectApiJson(
            await apiFetch('/api/v1/agents', apiKey, {
                method: 'POST',
                body: agent,
            }),
        ) as AgentExtendedModel;
        expect(createdAgent).toMatchObject({
            id: expect.stringContaining('api-test-agent'),
            name: 'API Test Agent',
            projectId: createdProject.id,
            llmGatewayId: gateway.id,
            modelAlias: ['gpt-4o'],
            sourceType: 'CONTAINER',
            buildMethod: 'DOCKERFILE',
        });

        createdAgent.name = 'API Test Agent Updated';
        createdAgent.warmPoolReplicas = 2;
        const updatedAgent = await expectApiJson(
            await apiFetch('/api/v1/agents', apiKey, {
                method: 'POST',
                body: createdAgent,
            }),
        );
        expect(updatedAgent).toMatchObject({
            id: createdAgent.id,
            name: 'API Test Agent Updated',
            warmPoolReplicas: 2,
        });

        const fetchedAgent = await expectApiJson(
            await apiFetch(`/api/v1/agents/${createdAgent.id}`, apiKey),
        );
        expect(fetchedAgent).toMatchObject({
            id: createdAgent.id,
            name: 'API Test Agent Updated',
            projectId: createdProject.id,
            modelAlias: ['gpt-4o'],
            project: {
                id: createdProject.id,
                projectType: 'AGENT',
            },
            llmGateway: {
                id: gateway.id,
                name: 'API Test Gateway',
            },
        });

        const allAgents = await expectApiJson(
            await apiFetch(`/api/v1/agents?projectId=${createdProject.id}`, apiKey),
        );
        expect(allAgents).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: createdAgent.id,
            }),
        ]));

        const deleteSpy = vi.spyOn(agentService, 'deleteById').mockImplementation(async (agentId: string) => {
            await dataAccess.client.agent.delete({ where: { id: agentId } });
        });
        try {
            await expectApiJson(
                await apiFetch(`/api/v1/agents/${createdAgent.id}`, apiKey, {
                    method: 'DELETE',
                }),
            );
            expect(deleteSpy).toHaveBeenCalledWith(createdAgent.id);

            const agentsAfterDelete = await expectApiJson(
                await apiFetch(`/api/v1/agents?projectId=${createdProject.id}`, apiKey),
            );
            expect(agentsAfterDelete).toEqual(expect.not.arrayContaining([
                expect.objectContaining({
                    id: createdAgent.id,
                }),
            ]));
        } finally {
            deleteSpy.mockRestore();
        }
    }, 420_000);

    it('returns sandbox access URL for existing agent domain', async () => {
        const apiKey = await createAdminApiKey();
        const { createdProject } = await createApiProject(apiKey, 'AGENT');
        const gateway = await dataAccess.client.llmGateway.create({
            data: {
                name: 'API Access URL Gateway',
                baseUrl: 'https://litellm.example.com',
                encryptedAdminKey: 'encrypted:test-key',
            },
        });

        const createdAgent = await expectApiJson(
            await apiFetch('/api/v1/agents', apiKey, {
                method: 'POST',
                body: {
                    ...createAgentPayload(undefined, createdProject.id, gateway.id, 'API Access URL Agent'),
                    agentDomains: [{ hostname: 'sandbox.agent.example.com', port: 8080, useSsl: true, redirectHttps: true }],
                } satisfies AgentExtendedWriteModel,
            }),
        ) as AgentExtendedModel;

        expect(createdAgent.agentDomains).toHaveLength(1);

        const expectedAccess = {
            url: 'https://sandbox.agent.example.com/?token=test-token',
            expiresAt: Math.floor(Date.now() / 1000) + 30,
        };

        const createAccessUrlSpy = vi.spyOn(agentAccessService, 'createAccessUrl').mockResolvedValue(expectedAccess);
        try {
            const accessUrl = await expectApiJson(
                await apiFetch(
                    `/api/v1/agents/${createdAgent.id}/sandboxes/test-claim/accessUrl/${createdAgent.agentDomains[0].id}`,
                    apiKey,
                ),
            );

            expect(accessUrl).toEqual(expectedAccess);
            expect(createAccessUrlSpy).toHaveBeenCalledWith(expect.objectContaining({
                agentId: createdAgent.id,
                sandboxName: 'test-claim',
                domainId: createdAgent.agentDomains[0].id,
                view: 'agent',
            }));
        } finally {
            createAccessUrlSpy.mockRestore();
        }
    });

    it('returns 400 when sandbox access URL is requested with unknown domain for agent', async () => {
        const apiKey = await createAdminApiKey();
        const { createdProject } = await createApiProject(apiKey, 'AGENT');
        const gateway = await dataAccess.client.llmGateway.create({
            data: {
                name: 'API Missing Domain Gateway',
                baseUrl: 'https://litellm.example.com',
                encryptedAdminKey: 'encrypted:test-key',
            },
        });

        const createdAgent = await expectApiJson(
            await apiFetch('/api/v1/agents', apiKey, {
                method: 'POST',
                body: {
                    ...createAgentPayload(undefined, createdProject.id, gateway.id, 'API Missing Domain Agent'),
                    agentDomains: [{ hostname: 'known.agent.example.com', port: 8080, useSsl: true, redirectHttps: true }],
                } satisfies AgentExtendedWriteModel,
            }),
        ) as AgentExtendedModel;

        const createAccessUrlSpy = vi.spyOn(agentAccessService, 'createAccessUrl');
        try {
            const response = await apiFetch(
                `/api/v1/agents/${createdAgent.id}/sandboxes/test-claim/accessUrl/domain-not-for-agent`,
                apiKey,
            );

            const problem = await expectApiProblem(response, 400);
            expect(problem.title).toBe('Bad Request');
            expect(problem.detail).toBe('Agent access domain is not configured.');
            expect(createAccessUrlSpy).not.toHaveBeenCalled();
        } finally {
            createAccessUrlSpy.mockRestore();
        }
    });

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

async function createGitAppForProject(projectId: string, apiKey: string) {
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

async function createApiProject(apiKey: string, projectType: 'APP' | 'AGENT' = 'APP') {
    const suffix = Date.now();
    const projectName = `API ${projectType} Project ${suffix}`;

    const createdProject = await expectApiJson(
        await apiFetch('/api/v1/projects', apiKey, {
            method: 'POST',
            body: { name: projectName, projectType },
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

function createAgentPayload(id: string | undefined, projectId: string, llmGatewayId: string, name: string): AgentExtendedWriteModel {
    const retVal = {
        name,
        projectId,
        llmGatewayId,
        modelAlias: ['gpt-4o'],
        sourceType: 'CONTAINER',
        buildMethod: 'DOCKERFILE',
        containerImageSource: 'custom/opencode:latest',
        dockerfilePath: './Dockerfile',
        warmPoolReplicas: 0,
        deployFileBrowser: false,
        healthCheckPeriodSeconds: 15,
        healthCheckTimeoutSeconds: 5,
        healthCheckFailureThreshold: 3,
        agentDomains: [],
        agentVolumes: [],
        agentFileMounts: [],
        agentNetworkPolicy: null,
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

async function expectApiProblem(response: Response, status: number) {
    const text = await response.text();
    const json = text ? JSON.parse(text) : undefined;

    expect(response.status, JSON.stringify(json)).toBe(status);

    return json as {
        type: string;
        title: string;
        status: number;
        detail?: string;
    };
}
