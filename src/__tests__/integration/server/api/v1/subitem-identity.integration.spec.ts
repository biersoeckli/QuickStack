// @vitest-environment node

import mockNextJsCaching from '@/__tests__/nextjs-cache.utils';
mockNextJsCaching();

const k3sMockState = vi.hoisted(() => {
    const namespaces = new Set<string>();

    return {
        namespaces,
        core: {
            listNamespace: vi.fn(async () => ({
                items: Array.from(namespaces).map((name) => ({ metadata: { name } })),
            })),
            createNamespace: vi.fn(async ({ body }: { body: { metadata?: { name?: string } } }) => {
                const name = body.metadata?.name;
                if (name) {
                    namespaces.add(name);
                }
                return {};
            }),
            deleteNamespace: vi.fn(async ({ name }: { name: string }) => {
                namespaces.delete(name);
                return {};
            }),
        },
    };
});

vi.mock('@/server/adapter/kubernetes-api.adapter', () => ({
    default: {
        core: k3sMockState.core,
    },
}));

import { createPrismaTestContext } from '@/__tests__/prisma-test.utils';
import { v1Api } from '@/server/api/v1/api-index';
import dataAccess from '@/server/adapter/db.client';
import restApiKeyService from '@/server/services/rest-api-key.service';
import userGroupService from '@/server/services/user-group.service';
import userService from '@/server/services/user.service';
import { AgentExtendedModel, AgentExtendedWriteModel } from '@/shared/model/agent-extended.model';
import { AppExtendedModel, AppExtendedWriteModel } from '@/shared/model/app-extended.model';
import { Project } from '@prisma/client';

describe('REST API v1 integration - nested subitem identity', () => {
    createPrismaTestContext('rest-api-v1-subitem-identity');

    beforeEach(() => {
        process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET ?? 'test-nextauth-secret';
        k3sMockState.namespaces.clear();
        vi.clearAllMocks();
    });

    it('strips nested App subitem ids when creating from a copied GET payload', async () => {
        const apiKey = await createAdminApiKey();
        const appProject = await createProject(apiKey, 'APP');
        const sourceApp = await expectApiJson(await apiFetch('/api/v1/apps', apiKey, {
            method: 'POST',
            body: createAppPayload(undefined, appProject.id, 'API Source App'),
        })) as AppExtendedModel;

        const fetchedApp = await expectApiJson(
            await apiFetch(`/api/v1/apps/${sourceApp.id}`, apiKey),
        ) as AppExtendedModel;

        const clonePayload = {
            ...fetchedApp,
            id: undefined,
            name: 'API Clone App',
            appDomains: fetchedApp.appDomains.map((domain) => ({
                ...domain,
                hostname: domain.hostname.replace('source', 'clone'),
            })),
            appNodePorts: fetchedApp.appNodePorts.map((nodePort) => ({
                ...nodePort,
                nodePort: nodePort.nodePort + 1,
            })),
            appNetworkPolicy: fetchedApp.appNetworkPolicy
                ? {
                    ...fetchedApp.appNetworkPolicy,
                    rules: fetchedApp.appNetworkPolicy.rules.map(({ targetApp: _targetApp, targetAgent: _targetAgent, ...rule }) => rule),
                }
                : null,
        } satisfies AppExtendedWriteModel;

        const clonedApp = await expectApiJson(await apiFetch('/api/v1/apps', apiKey, {
            method: 'POST',
            body: clonePayload,
        })) as AppExtendedModel;

        expect(clonedApp.id).not.toBe(sourceApp.id);
        expect(clonedApp.appDomains[0].id).not.toBe(sourceApp.appDomains[0].id);
        expect(clonedApp.appPorts[0].id).not.toBe(sourceApp.appPorts[0].id);
        expect(clonedApp.appNodePorts[0].id).not.toBe(sourceApp.appNodePorts[0].id);
        expect(clonedApp.appFileMounts[0].id).not.toBe(sourceApp.appFileMounts[0].id);
        expect(clonedApp.appVolumes[0].id).not.toBe(sourceApp.appVolumes[0].id);
        expect(clonedApp.appBasicAuths[0].id).not.toBe(sourceApp.appBasicAuths[0].id);

        await expect(dataAccess.client.appDomain.findUniqueOrThrow({ where: { id: sourceApp.appDomains[0].id } }))
            .resolves.toMatchObject({ appId: sourceApp.id, hostname: 'source.example.com' });
        await expect(dataAccess.client.appDomain.findUniqueOrThrow({ where: { id: clonedApp.appDomains[0].id } }))
            .resolves.toMatchObject({ appId: clonedApp.id, hostname: 'clone.example.com' });
    });

    it('replaces all App subitem collections through the API', async () => {
        const apiKey = await createAdminApiKey();
        const project = await createProject(apiKey, 'APP');
        const app = await expectApiJson(await apiFetch('/api/v1/apps', apiKey, {
            method: 'POST',
            body: createAppPayload(undefined, project.id, 'Full Schema Write App'),
        })) as AppExtendedModel;

        const updated = await expectApiJson(await apiFetch('/api/v1/apps', apiKey, {
            method: 'POST',
            body: {
                ...app,
                appDomains: [],
                appPorts: [],
                appNodePorts: [],
                appFileMounts: [],
                appVolumes: [],
                appBasicAuths: [],
            },
        })) as AppExtendedModel;

        expect(updated).toMatchObject({
            appDomains: [],
            appPorts: [],
            appNodePorts: [],
            appFileMounts: [],
            appVolumes: [],
            appBasicAuths: [],
        });
    });

    it('preserves App network policy rule IDs when updating through the API', async () => {
        const apiKey = await createAdminApiKey();
        const project = await createProject(apiKey, 'APP');
        const targetApp = await dataAccess.client.app.create({
            data: { name: 'Policy Target App', projectId: project.id },
        });
        const app = await expectApiJson(await apiFetch('/api/v1/apps', apiKey, {
            method: 'POST',
            body: createAppPayload(undefined, project.id, 'Policy Source App'),
        })) as AppExtendedModel;

        const savedWithRule = await expectApiJson(await apiFetch('/api/v1/apps', apiKey, {
            method: 'POST',
            body: {
                ...app,
                appNetworkPolicy: {
                    allowInternetAccess: true,
                    rules: [{
                        targetAppId: targetApp.id,
                        targetAgentId: null,
                        type: 'EGRESS',
                        port: 443,
                        protocol: 'TCP',
                    }],
                },
            },
        })) as AppExtendedModel;
        const ruleId = savedWithRule.appNetworkPolicy!.rules[0].id;

        const updated = await expectApiJson(await apiFetch('/api/v1/apps', apiKey, {
            method: 'POST',
            body: {
                ...savedWithRule,
                envVars: 'UPDATED=true',
            },
        })) as AppExtendedModel;

        expect(updated.envVars).toBe('UPDATED=true');
        expect(updated.appNetworkPolicy).toMatchObject({
            rules: [expect.objectContaining({ id: ruleId, targetAppId: targetApp.id, port: 443 })],
        });
    });

    it('reports the current API error when an App network policy configuration is omitted', async () => {
        const apiKey = await createAdminApiKey();
        const project = await createProject(apiKey, 'APP');
        const { appNetworkPolicy: _appNetworkPolicy, ...payload } = createAppPayload(undefined, project.id, 'Missing Policy App');

        const problem = await expectApiProblem(await apiFetch('/api/v1/apps', apiKey, {
            method: 'POST',
            body: payload,
        }), 500);

        expect(problem.detail).toBe('An unknown error occurred.');
    });

    it('removes an App network policy configuration when the API receives null', async () => {
        const apiKey = await createAdminApiKey();
        const project = await createProject(apiKey, 'APP');
        const app = await expectApiJson(await apiFetch('/api/v1/apps', apiKey, {
            method: 'POST',
            body: createAppPayload(undefined, project.id, 'Policy Removal App'),
        })) as AppExtendedModel;
        const withPolicy = await expectApiJson(await apiFetch('/api/v1/apps', apiKey, {
            method: 'POST',
            body: {
                ...app,
                appNetworkPolicy: { allowInternetAccess: false, rules: [] },
            },
        })) as AppExtendedModel;

        await expectApiJson(await apiFetch('/api/v1/apps', apiKey, {
            method: 'POST',
            body: { ...withPolicy, appNetworkPolicy: null },
        }));

        await expect(dataAccess.client.appNetworkPolicy.findUnique({ where: { appId: app.id } }))
            .resolves.toBeNull();
    });

    it('rejects an App network policy configuration ID from another App through the API', async () => {
        const apiKey = await createAdminApiKey();
        const project = await createProject(apiKey, 'APP');
        const app = await expectApiJson(await apiFetch('/api/v1/apps', apiKey, {
                method: 'POST',
                body: createAppPayload(undefined, project.id, 'Policy Owner App'),
            })) as AppExtendedModel;
        const otherApp = await expectApiJson(await apiFetch('/api/v1/apps', apiKey, {
                method: 'POST',
                body: {
                    ...createAppPayload(undefined, project.id, 'Other Policy Owner App'),
                    appDomains: [{ hostname: 'other-policy-owner.example.com', port: 8080, useSsl: true, redirectHttps: true }],
                    appNodePorts: [{ port: 8080, nodePort: 30081, protocol: 'TCP' }],
                },
            })) as AppExtendedModel;
        const otherPolicy = await dataAccess.client.appNetworkPolicy.create({
            data: { appId: otherApp.id, allowInternetAccess: true },
        });

        const problem = await expectApiProblem(await apiFetch('/api/v1/apps', apiKey, {
            method: 'POST',
            body: {
                ...app,
                appNetworkPolicy: { id: otherPolicy.id, allowInternetAccess: true, rules: [] },
            },
        }), 400);

        expect(problem.detail).toBe('App network policy configuration not found.');
    });

    it('rejects duplicate App network policy rules through the API', async () => {
        const apiKey = await createAdminApiKey();
        const project = await createProject(apiKey, 'APP');
        const targetApp = await dataAccess.client.app.create({
            data: { name: 'Policy Target App', projectId: project.id },
        });
        const app = await expectApiJson(await apiFetch('/api/v1/apps', apiKey, {
            method: 'POST',
            body: createAppPayload(undefined, project.id, 'Duplicate Rule Source App'),
        })) as AppExtendedModel;
        const rule = {
            targetAppId: targetApp.id,
            targetAgentId: null,
            type: 'EGRESS',
            port: 443,
            protocol: 'TCP',
        };

        const problem = await expectApiProblem(await apiFetch('/api/v1/apps', apiKey, {
            method: 'POST',
            body: {
                ...app,
                appNetworkPolicy: { allowInternetAccess: true, rules: [rule, rule] },
            },
        }), 400);

        expect(problem.detail).toBe('A matching network policy rule already exists.');
    });

    it('rejects self-referencing App network policy rules through the API', async () => {
        const apiKey = await createAdminApiKey();
        const project = await createProject(apiKey, 'APP');
        const app = await expectApiJson(await apiFetch('/api/v1/apps', apiKey, {
            method: 'POST',
            body: createAppPayload(undefined, project.id, 'Self Reference Source App'),
        })) as AppExtendedModel;

        const problem = await expectApiProblem(await apiFetch('/api/v1/apps', apiKey, {
            method: 'POST',
            body: {
                ...app,
                appNetworkPolicy: {
                    allowInternetAccess: true,
                    rules: [{
                        targetAppId: app.id,
                        targetAgentId: null,
                        type: 'EGRESS',
                        port: 443,
                        protocol: 'TCP',
                    }],
                },
            },
        }), 400);

        expect(problem.detail).toBe('An app cannot reference itself.');
    });

    it('strips nested Agent subitem ids when creating from a copied GET payload', async () => {
        const apiKey = await createAdminApiKey();
        const agentProject = await createProject(apiKey, 'AGENT');
        const appProject = await createProject(apiKey, 'APP');
        const targetApp = await dataAccess.client.app.create({
            data: { name: 'Policy Target App', projectId: appProject.id },
        });
        const gateway = await dataAccess.client.llmGateway.create({
            data: {
                name: 'API Test Gateway',
                baseUrl: 'https://litellm.example.com',
                encryptedAdminKey: 'encrypted:test-key',
            },
        });

        const sourceAgent = await expectApiJson(await apiFetch('/api/v1/agents', apiKey, {
            method: 'POST',
            body: createAgentPayload(undefined, agentProject.id, gateway.id, targetApp.id, 'API Source Agent'),
        })) as AgentExtendedModel;

        const fetchedAgent = await expectApiJson(
            await apiFetch(`/api/v1/agents/${sourceAgent.id}`, apiKey),
        ) as AgentExtendedModel;

        const clonePayload = {
            ...fetchedAgent,
            id: undefined,
            name: 'API Clone Agent',
            agentDomains: fetchedAgent.agentDomains.map((domain) => ({
                ...domain,
                hostname: domain.hostname.replace('source', 'clone'),
            })),
            agentNetworkPolicy: fetchedAgent.agentNetworkPolicy
                ? {
                    ...fetchedAgent.agentNetworkPolicy,
                    rules: fetchedAgent.agentNetworkPolicy.rules.map(({ targetApp: _targetApp, ...rule }) => rule),
                }
                : null,
        } satisfies AgentExtendedWriteModel;

        const clonedAgent = await expectApiJson(await apiFetch('/api/v1/agents', apiKey, {
            method: 'POST',
            body: clonePayload,
        })) as AgentExtendedModel;

        expect(clonedAgent.id).not.toBe(sourceAgent.id);
        expect(clonedAgent.agentDomains[0].id).not.toBe(sourceAgent.agentDomains[0].id);
        expect(clonedAgent.agentVolumes[0].id).not.toBe(sourceAgent.agentVolumes[0].id);
        expect(clonedAgent.agentFileMounts[0].id).not.toBe(sourceAgent.agentFileMounts[0].id);
        expect(clonedAgent.agentNetworkPolicy?.id).not.toBe(sourceAgent.agentNetworkPolicy?.id);
        expect(clonedAgent.agentNetworkPolicy?.rules[0].id).not.toBe(sourceAgent.agentNetworkPolicy?.rules[0].id);

        await expect(dataAccess.client.agentDomain.findUniqueOrThrow({ where: { id: sourceAgent.agentDomains[0].id } }))
            .resolves.toMatchObject({ agentId: sourceAgent.id, hostname: 'source.agent.example.com' });
        await expect(dataAccess.client.agentDomain.findUniqueOrThrow({ where: { id: clonedAgent.agentDomains[0].id } }))
            .resolves.toMatchObject({ agentId: clonedAgent.id, hostname: 'clone.agent.example.com' });
    });

    it('reports the current API error when an Agent network policy configuration is omitted', async () => {
        const apiKey = await createAdminApiKey();
        const agentProject = await createProject(apiKey, 'AGENT');
        const appProject = await createProject(apiKey, 'APP');
        const targetApp = await dataAccess.client.app.create({ data: { name: 'Policy Target App', projectId: appProject.id } });
        const gateway = await dataAccess.client.llmGateway.create({
            data: { name: 'Agent Policy Gateway', baseUrl: 'https://litellm.example.com', encryptedAdminKey: 'encrypted:test-key' },
        });
        const { agentNetworkPolicy: _agentNetworkPolicy, ...payload } = createAgentPayload(undefined, agentProject.id, gateway.id, targetApp.id, 'Missing Agent Policy');

        const problem = await expectApiProblem(await apiFetch('/api/v1/agents', apiKey, {
            method: 'POST',
            body: payload,
        }), 500);

        expect(problem.detail).toBe('An unknown error occurred.');
    });

    it('removes an Agent network policy configuration when the API receives null', async () => {
        const apiKey = await createAdminApiKey();
        const agentProject = await createProject(apiKey, 'AGENT');
        const appProject = await createProject(apiKey, 'APP');
        const targetApp = await dataAccess.client.app.create({ data: { name: 'Policy Target App', projectId: appProject.id } });
        const gateway = await dataAccess.client.llmGateway.create({
            data: { name: 'Agent Policy Gateway', baseUrl: 'https://litellm.example.com', encryptedAdminKey: 'encrypted:test-key' },
        });
        const agent = await expectApiJson(await apiFetch('/api/v1/agents', apiKey, {
            method: 'POST',
            body: createAgentPayload(undefined, agentProject.id, gateway.id, targetApp.id, 'Agent Policy Removal'),
        })) as AgentExtendedModel;

        await expectApiJson(await apiFetch('/api/v1/agents', apiKey, {
            method: 'POST',
            body: { ...agent, agentNetworkPolicy: null },
        }));

        await expect(dataAccess.client.agentNetworkPolicy.findUnique({ where: { agentId: agent.id } }))
            .resolves.toBeNull();
    });

    it('rejects an Agent network policy configuration ID from another Agent through the API', async () => {
        const apiKey = await createAdminApiKey();
        const agentProject = await createProject(apiKey, 'AGENT');
        const appProject = await createProject(apiKey, 'APP');
        const targetApp = await dataAccess.client.app.create({ data: { name: 'Policy Target App', projectId: appProject.id } });
        const gateway = await dataAccess.client.llmGateway.create({
            data: { name: 'Agent Policy Gateway', baseUrl: 'https://litellm.example.com', encryptedAdminKey: 'encrypted:test-key' },
        });
        const [agent, otherAgent] = await Promise.all(['Agent Policy Owner', 'Other Agent Policy Owner'].map(async name =>
            await expectApiJson(await apiFetch('/api/v1/agents', apiKey, {
                method: 'POST',
                body: createAgentPayload(undefined, agentProject.id, gateway.id, targetApp.id, name),
            })) as AgentExtendedModel,
        ));

        const problem = await expectApiProblem(await apiFetch('/api/v1/agents', apiKey, {
            method: 'POST',
            body: {
                ...agent,
                agentNetworkPolicy: {
                    id: otherAgent.agentNetworkPolicy!.id,
                    allowInternetAccess: true,
                    rules: [],
                },
            },
        }), 400);

        expect(problem.detail).toBe('Agent network policy configuration not found.');
    });
});

async function createAdminApiKey() {
    const adminRole = await userGroupService.getOrCreateAdminRole();
    const user = await userService.registerUser(`admin-api-test-${crypto.randomUUID()}@example.com`, 'test-password', adminRole.id);
    return restApiKeyService.create(user.id, 'integration-test');
}

async function createProject(apiKey: string, projectType: 'APP' | 'AGENT') {
    return await expectApiJson(await apiFetch('/api/v1/projects', apiKey, {
        method: 'POST',
        body: { name: `${projectType} Project ${crypto.randomUUID()}`, projectType },
    })) as Project;
}

function createAppPayload(id: string | undefined, projectId: string, name: string): AppExtendedWriteModel {
    const retVal = {
        name,
        appType: 'APP',
        projectId,
        sourceType: 'CONTAINER',
        buildMethod: 'RAILPACK',
        containerImageSource: 'nginx:latest',
        dockerfilePath: './Dockerfile',
        replicas: 1,
        envVars: '',
        ingressNetworkPolicy: 'ALLOW_ALL',
        egressNetworkPolicy: 'ALLOW_ALL',
        useNetworkPolicy: true,
        healthCheckPeriodSeconds: 15,
        healthCheckTimeoutSeconds: 5,
        healthCheckFailureThreshold: 3,
        appDomains: [{ hostname: 'source.example.com', port: 8080, useSsl: true, redirectHttps: true }],
        appPorts: [{ port: 8080 }],
        appNodePorts: [{ port: 8080, nodePort: 30080, protocol: 'TCP' }],
        appFileMounts: [{ containerMountPath: '/etc/app/config.json', content: '{}' }],
        appVolumes: [{ containerMountPath: '/data', size: 1, accessMode: 'rwo', storageClassName: 'longhorn', shareWithOtherApps: false }],
        appBasicAuths: [{ username: 'source-user', password: 'source-pass' }],
        appNetworkPolicy: null,
    };
    if (id) {
        return { ...retVal, id };
    }
    return retVal;
}

function createAgentPayload(
    id: string | undefined,
    projectId: string,
    llmGatewayId: string,
    targetAppId: string,
    name: string,
): AgentExtendedWriteModel {
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
        agentDomains: [{ hostname: 'source.agent.example.com', port: 8080, useSsl: true, redirectHttps: true }],
        agentVolumes: [{ containerMountPath: '/workspace', size: 1, storageClassName: 'longhorn' }],
        agentFileMounts: [{ containerMountPath: '/workspace/config.json', content: '{}' }],
        agentNetworkPolicy: {
            allowInternetAccess: true,
            rules: [{ type: 'EGRESS', targetAppId, port: 443, protocol: 'TCP' }],
        },
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
    return json as { detail?: string };
}
