// @vitest-environment node

import mockNextJsCaching from '@/__tests__/nextjs-cache.utils';
mockNextJsCaching();

vi.mock('@/server/adapter/kubernetes-api.adapter', () => ({ default: {} }));

import { createPrismaTestContext } from '@/__tests__/prisma-test.utils';
import agentService from '@/server/services/agent.service';
import dataAccess from '@/server/adapter/db.client';
import { AgentExtendedWriteModel } from '@/shared/model/agent-extended.model';

describe('agent.service integration - saveAgentExtendedModel', () => {
    createPrismaTestContext('agent-service-save-extended');

    let agentId: string;
    let targetAppIdA: string;
    let targetAppIdB: string;

    beforeEach(async () => {
        const agentProject = await dataAccess.client.project.create({
            data: { name: 'Agent Project', projectType: 'AGENT' },
        });

        const appProject = await dataAccess.client.project.create({
            data: { name: 'App Project', projectType: 'APP' },
        });

        const gateway = await dataAccess.client.llmGateway.create({
            data: { name: 'Test Gateway', baseUrl: 'https://litellm.example.com', encryptedAdminKey: 'encrypted:test-key' },
        });

        const agent = await dataAccess.client.agent.create({
            data: {
                name: 'Integration Agent',
                projectId: agentProject.id,
                llmGatewayId: gateway.id,
                modelAlias: JSON.stringify(['gpt-4o']),
            },
        });
        agentId = agent.id;

        const targetAppA = await dataAccess.client.app.create({
            data: {
                name: 'Target App A',
                projectId: appProject.id,
            },
        });
        targetAppIdA = targetAppA.id;

        const targetAppB = await dataAccess.client.app.create({
            data: {
                name: 'Target App B',
                projectId: appProject.id,
            },
        });
        targetAppIdB = targetAppB.id;
    });

    async function buildWriteModel(overrides: Partial<AgentExtendedWriteModel>): Promise<AgentExtendedWriteModel> {
        const current = await agentService.getById(agentId);
        return {
            ...current,
            ...overrides,
        } as AgentExtendedWriteModel;
    }

    it('keeps newly created sub-resources without ids', async () => {
        const writeModel = await buildWriteModel({
            agentDomains: [{ hostname: 'new.example.com', port: 8080, useSsl: true, redirectHttps: true } as any],
            agentVolumes: [{ containerMountPath: '/workspace', size: 10, storageClassName: 'longhorn' } as any],
            agentFileMounts: [{ containerMountPath: '/workspace/config.json', content: '{"k":"v"}' } as any],
            agentNetworkPolicy: {
                allowInternetAccess: true,
                rules: [{ targetAppId: targetAppIdA, port: 443, protocol: 'TCP' }],
            } as any,
        });

        const result = await agentService.saveAgentExtendedModel(writeModel);

        const domains = await dataAccess.client.agentDomain.findMany({ where: { agentId } });
        const volumes = await dataAccess.client.agentVolume.findMany({ where: { agentId } });
        const fileMounts = await dataAccess.client.agentFileMount.findMany({ where: { agentId } });
        const policy = await dataAccess.client.agentNetworkPolicy.findUnique({ where: { agentId } });
        const rules = policy
            ? await dataAccess.client.agentNetworkPolicyRule.findMany({ where: { agentNetworkPolicyId: policy.id } })
            : [];

        expect(domains).toHaveLength(1);
        expect(volumes).toHaveLength(1);
        expect(fileMounts).toHaveLength(1);
        expect(rules).toHaveLength(1);

        expect(result.agentDomains).toHaveLength(1);
        expect(result.agentVolumes).toHaveLength(1);
        expect(result.agentFileMounts).toHaveLength(1);
        expect(result.agentNetworkPolicy?.rules ?? []).toHaveLength(1);
    });

    it('replaces stale sub-resources and keeps newly created replacements without ids', async () => {
        const staleDomain = await dataAccess.client.agentDomain.create({
            data: { agentId, hostname: 'stale.example.com', port: 3000, useSsl: false, redirectHttps: false },
        });
        const staleVolume = await dataAccess.client.agentVolume.create({
            data: { agentId, containerMountPath: '/stale', size: 1, storageClassName: 'longhorn' },
        });
        const staleFileMount = await dataAccess.client.agentFileMount.create({
            data: { agentId, containerMountPath: '/stale.txt', content: 'stale' },
        });
        const policy = await dataAccess.client.agentNetworkPolicy.create({ data: { agentId, allowInternetAccess: true } });
        const staleRule = await dataAccess.client.agentNetworkPolicyRule.create({
            data: {
                agentNetworkPolicyId: policy.id,
                type: 'EGRESS',
                targetAppId: targetAppIdA,
                port: 443,
                protocol: 'TCP',
            },
        });

        const writeModel = await buildWriteModel({
            agentDomains: [{ hostname: 'fresh.example.com', port: 8080, useSsl: true, redirectHttps: true } as any],
            agentVolumes: [{ containerMountPath: '/fresh', size: 20, storageClassName: 'longhorn' } as any],
            agentFileMounts: [{ containerMountPath: '/fresh.txt', content: 'fresh' } as any],
            agentNetworkPolicy: {
                allowInternetAccess: false,
                rules: [{ targetAppId: targetAppIdB, port: 8443, protocol: 'TCP' }],
            } as any,
        });

        await agentService.saveAgentExtendedModel(writeModel);

        const domains = await dataAccess.client.agentDomain.findMany({ where: { agentId } });
        const volumes = await dataAccess.client.agentVolume.findMany({ where: { agentId } });
        const fileMounts = await dataAccess.client.agentFileMount.findMany({ where: { agentId } });
        const refreshedPolicy = await dataAccess.client.agentNetworkPolicy.findUniqueOrThrow({ where: { agentId } });
        const rules = await dataAccess.client.agentNetworkPolicyRule.findMany({ where: { agentNetworkPolicyId: refreshedPolicy.id } });

        expect(domains).toHaveLength(1);
        expect(domains[0].hostname).toBe('fresh.example.com');
        expect(domains[0].id).not.toBe(staleDomain.id);

        expect(volumes).toHaveLength(1);
        expect(volumes[0].containerMountPath).toBe('/fresh');
        expect(volumes[0].id).not.toBe(staleVolume.id);

        expect(fileMounts).toHaveLength(1);
        expect(fileMounts[0].containerMountPath).toBe('/fresh.txt');
        expect(fileMounts[0].id).not.toBe(staleFileMount.id);

        expect(rules).toHaveLength(1);
        expect(rules[0].targetAppId).toBe(targetAppIdB);
        expect(rules[0].id).not.toBe(staleRule.id);

        expect(refreshedPolicy.allowInternetAccess).toBe(false);
    });
});
