const dbMocks = vi.hoisted(() => {
    const client = {
        agent: {
            findFirstOrThrow: vi.fn(),
        },
        app: {
            findFirst: vi.fn(),
            findMany: vi.fn(),
        },
        agentNetworkPolicy: {
            findUnique: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
        },
        agentNetworkPolicyRule: {
            findUnique: vi.fn(),
            findFirst: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
            deleteMany: vi.fn(),
        },
        $transaction: vi.fn(),
    };
    client.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(client));
    return { client };
});

const mirrorServiceMocks = vi.hoisted(() => ({
    unmirrorAgentEgressRule: vi.fn(),
    mirrorAgentEgressRuleSave: vi.fn(),
}));

vi.mock('next/cache', () => ({
    revalidateTag: vi.fn(),
}));

vi.mock('@/server/adapter/db.client', () => ({
    default: { client: dbMocks.client },
}));

vi.mock('./network-policy-rule-mirror.service', () => ({
    default: mirrorServiceMocks,
}));

import agentNetworkPolicyService from './agent-network-policy.service';
import { revalidateTag } from 'next/cache';

const adminSession = { userGroup: { name: 'admin' } } as any;

describe('agent-network-policy.service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mirrorServiceMocks.unmirrorAgentEgressRule.mockResolvedValue([]);
        mirrorServiceMocks.mirrorAgentEgressRuleSave.mockResolvedValue([]);
        dbMocks.client.agentNetworkPolicyRule.delete.mockResolvedValue({ id: 'rule-1' });
        dbMocks.client.agentNetworkPolicyRule.update.mockResolvedValue({ id: 'rule-1' });
        dbMocks.client.app.findMany.mockImplementation(({ where }: { where: { id: { in: string[] } } }) =>
            Promise.resolve(where.id.in.map(id => ({ id, projectId: `project-${id}` }))));
    });

    it('removes the mirrored INGRESS counterpart when an egress rule is deleted', async () => {
        dbMocks.client.agentNetworkPolicyRule.findUnique.mockResolvedValue({
            id: 'rule-1',
            targetAppId: 'app-b',
            port: 8080,
            protocol: 'TCP',
            agentNetworkPolicy: {
                id: 'policy-1',
                agentId: 'agent-1',
                agent: { projectId: 'project-1' },
            },
        });
        mirrorServiceMocks.unmirrorAgentEgressRule.mockResolvedValue([
            { workloadType: 'APP', workloadId: 'app-b', projectId: 'project-b' },
        ]);

        await agentNetworkPolicyService.deleteEgressRule('rule-1', adminSession);

        expect(dbMocks.client.agentNetworkPolicyRule.delete).toHaveBeenCalledWith({
            where: { id: 'rule-1' },
        });
        expect(mirrorServiceMocks.unmirrorAgentEgressRule).toHaveBeenCalledWith(
            dbMocks.client, adminSession, 'agent-1', 'app-b', 8080, 'TCP',
        );
    });

    it('does not touch the mirrored counterpart when an egress rule is deleted without a session', async () => {
        dbMocks.client.agentNetworkPolicyRule.findUnique.mockResolvedValue({
            id: 'rule-1',
            targetAppId: 'app-b',
            port: 8080,
            protocol: 'TCP',
            agentNetworkPolicy: {
                id: 'policy-1',
                agentId: 'agent-1',
                agent: { projectId: 'project-1' },
            },
        });

        await agentNetworkPolicyService.deleteEgressRule('rule-1');

        expect(dbMocks.client.agentNetworkPolicyRule.delete).toHaveBeenCalledWith({
            where: { id: 'rule-1' },
        });
        expect(mirrorServiceMocks.unmirrorAgentEgressRule).not.toHaveBeenCalled();
    });

    it('removes the old counterpart and mirrors the new one when an egress rule changes port', async () => {
        dbMocks.client.agent.findFirstOrThrow.mockResolvedValue({ id: 'agent-1', projectId: 'project-1' });
        dbMocks.client.agentNetworkPolicy.findUnique.mockResolvedValue(null);
        dbMocks.client.agentNetworkPolicy.create.mockResolvedValue({ id: 'policy-1' });
        dbMocks.client.agentNetworkPolicyRule.findUnique.mockResolvedValue({
            targetAppId: 'app-b',
            port: 8080,
            protocol: 'TCP',
        });
        dbMocks.client.app.findFirst.mockResolvedValue({ id: 'app-b' });
        dbMocks.client.agentNetworkPolicyRule.findFirst.mockImplementation(({ where }: { where: { id?: string | { not: string } } }) => {
            if (where.id && typeof where.id === 'object') {
                return Promise.resolve(null);
            }
            if (where.id) {
                return Promise.resolve({ id: where.id });
            }
            return Promise.resolve(null);
        });

        await agentNetworkPolicyService.saveEgressRule({
            agentId: 'agent-1',
            id: 'rule-1',
            type: 'EGRESS',
            targetAppId: 'app-b',
            port: 9090,
            protocol: 'TCP',
        }, adminSession);

        expect(mirrorServiceMocks.unmirrorAgentEgressRule).toHaveBeenCalledWith(
            dbMocks.client, adminSession, 'agent-1', 'app-b', 8080, 'TCP',
        );
        expect(mirrorServiceMocks.mirrorAgentEgressRuleSave).toHaveBeenCalledWith(
            dbMocks.client, adminSession, 'app-b', 'agent-1', 9090, 'TCP',
        );
        expect(revalidateTag).toHaveBeenCalledWith('app-app-b');
        expect(revalidateTag).toHaveBeenCalledWith('apps-project-app-b');
    });
});
