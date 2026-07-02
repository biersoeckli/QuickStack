// @vitest-environment node

import mockNextJsCaching from '@/__tests__/nextjs-cache.utils';
mockNextJsCaching();

import { createPrismaTestContext } from '@/__tests__/prisma-test.utils';
import { revalidateTag } from 'next/cache';
import { Tags } from '@/server/utils/cache-tag-generator.utils';
import agentDomainService from '@/server/services/agent-domain.service';
import dataAccess from '@/server/adapter/db.client';

describe('agent-domain.service', () => {
    const dbCtx = createPrismaTestContext('agent-domain');

    let projectId: string;
    let llmGatewayId: string;
    let agentId: string;

    beforeEach(async () => {
        vi.clearAllMocks();

        // Create prerequisite records
        const project = await dataAccess.client.project.create({
            data: { name: 'Test Project', projectType: 'AGENT' },
        });
        projectId = project.id;

        const gateway = await dataAccess.client.llmGateway.create({
            data: { name: 'Test Gateway', baseUrl: 'http://test', encryptedAdminKey: 'key' },
        });
        llmGatewayId = gateway.id;

        const agent = await dataAccess.client.agent.create({
            data: {
                name: 'Test Agent',
                projectId,
                llmGatewayId,
                modelAlias: 'test-model',
            },
        });
        agentId = agent.id;
    });

    describe('saveDomain', () => {
        it('creates a new domain and revalidates caches', async () => {
            await agentDomainService.saveDomain({
                agentId,
                hostname: 'test.example.com',
                port: 8080,
                useSsl: true,
                redirectHttps: false,
            });

            const domains = await dataAccess.client.agentDomain.findMany({ where: { agentId } });
            expect(domains).toHaveLength(1);
            expect(domains[0].hostname).toBe('test.example.com');
            expect(domains[0].port).toBe(8080);
            expect(domains[0].useSsl).toBe(true);
            expect(domains[0].redirectHttps).toBe(false);

            expect(revalidateTag).toHaveBeenCalledWith(Tags.agent(agentId));
            expect(revalidateTag).toHaveBeenCalledWith(Tags.agents(projectId));
        });

        it('updates an existing domain', async () => {
            const created = await dataAccess.client.agentDomain.create({
                data: { agentId, hostname: 'update.example.com', port: 3000 },
            });

            await agentDomainService.saveDomain({
                id: created.id,
                agentId,
                hostname: 'update.example.com',
                port: 4000,
                useSsl: false,
                redirectHttps: true,
            });

            const updated = await dataAccess.client.agentDomain.findUniqueOrThrow({ where: { id: created.id } });
            expect(updated.port).toBe(4000);
            expect(updated.useSsl).toBe(false);
            expect(updated.redirectHttps).toBe(true);
        });

        it('rejects update for non-existent domain', async () => {
            await expect(agentDomainService.saveDomain({
                id: 'non-existent-id',
                agentId,
                hostname: 'missing.example.com',
                port: 8080,
            })).rejects.toThrow('Agent domain not found.');
        });

        it('rejects duplicate hostname across different agents', async () => {
            const agent2 = await dataAccess.client.agent.create({
                data: { name: 'Agent 2', projectId, llmGatewayId, modelAlias: 'm2' },
            });

            await agentDomainService.saveDomain({ agentId, hostname: 'shared.example.com', port: 8080 });

            await expect(agentDomainService.saveDomain({
                agentId: agent2.id,
                hostname: 'shared.example.com',
                port: 9090,
            })).rejects.toThrow('Domain is already assigned to another Agent.');
        });
    });

    describe('deleteDomain', () => {
        it('deletes a domain and revalidates caches', async () => {
            const domain = await dataAccess.client.agentDomain.create({
                data: { agentId, hostname: 'delete.example.com', port: 8080 },
            });

            await agentDomainService.deleteDomain(domain.id);

            const remaining = await dataAccess.client.agentDomain.findMany({ where: { agentId } });
            expect(remaining).toHaveLength(0);
            expect(revalidateTag).toHaveBeenCalledWith(Tags.agent(agentId));
            expect(revalidateTag).toHaveBeenCalledWith(Tags.agents(projectId));
        });

        it('does nothing when domain does not exist', async () => {
            await expect(agentDomainService.deleteDomain('non-existent')).resolves.toBeUndefined();
        });
    });

    describe('getDomainById', () => {
        it('returns a domain by id', async () => {
            const domain = await dataAccess.client.agentDomain.create({
                data: { agentId, hostname: 'get.example.com', port: 8080 },
            });

            const found = await agentDomainService.getDomainById(domain.id);
            expect(found.id).toBe(domain.id);
            expect(found.hostname).toBe('get.example.com');
        });

        it('throws for non-existent domain id', async () => {
            await expect(agentDomainService.getDomainById('missing')).rejects.toThrow('Agent domain not found.');
        });
    });

    describe('getDomainForAgent', () => {
        it('returns domain scoped to agent', async () => {
            const domain = await dataAccess.client.agentDomain.create({
                data: { agentId, hostname: 'scoped.example.com', port: 8080 },
            });

            const found = await agentDomainService.getDomainForAgent(agentId, domain.id);
            expect(found.hostname).toBe('scoped.example.com');
        });

        it('throws when domain does not belong to agent', async () => {
            const agent2 = await dataAccess.client.agent.create({
                data: { name: 'Agent 2', projectId, llmGatewayId, modelAlias: 'm2' },
            });
            const domain = await dataAccess.client.agentDomain.create({
                data: { agentId: agent2.id, hostname: 'other.example.com', port: 8080 },
            });

            await expect(agentDomainService.getDomainForAgent(agentId, domain.id))
                .rejects.toThrow('Agent access domain is not configured.');
        });
    });
});
