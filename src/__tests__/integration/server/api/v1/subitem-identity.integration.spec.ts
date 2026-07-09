// @vitest-environment node

import mockNextJsCaching from '@/__tests__/nextjs-cache.utils';
mockNextJsCaching();

vi.mock('@/server/adapter/kubernetes-api.adapter', () => ({ default: {} }));

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
