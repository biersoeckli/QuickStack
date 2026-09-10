const dbMocks = vi.hoisted(() => {
    const client = {
        app: {
            findUniqueOrThrow: vi.fn(),
            findUnique: vi.fn(),
            findMany: vi.fn(),
            update: vi.fn(),
        },
        agent: {
            findUnique: vi.fn(),
            findMany: vi.fn(),
        },
        appNetworkPolicy: {
            upsert: vi.fn(),
            update: vi.fn(),
        },
        appNetworkPolicyRule: {
            findMany: vi.fn(),
            findFirst: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            deleteMany: vi.fn(),
        },
        $transaction: vi.fn(),
    };
    client.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(client));
    return { client };
});

const mirrorServiceMocks = vi.hoisted(() => ({
    mirrorAppConfigurationSave: vi.fn(),
    unmirrorAppRules: vi.fn(),
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

import appNetworkPolicyService from './app-network-policy.service';
import { revalidateTag } from 'next/cache';

describe('app-network-policy.service', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        dbMocks.client.app.findUniqueOrThrow.mockResolvedValue({ id: 'app-1', projectId: 'project-1' });
        dbMocks.client.app.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
            Promise.resolve({ id: where.id, projectId: 'project-1' }));
        dbMocks.client.app.findMany.mockImplementation(({ where }: { where: { id: { in: string[] } } }) =>
            Promise.resolve(where.id.in.map(id => ({ id, projectId: `project-${id}` }))));
        dbMocks.client.agent.findMany.mockImplementation(({ where }: { where: { id: { in: string[] } } }) =>
            Promise.resolve(where.id.in.map(id => ({ id, projectId: `project-${id}` }))));
        dbMocks.client.agent.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
            Promise.resolve({ id: where.id, projectId: `project-${where.id}` }));
        dbMocks.client.appNetworkPolicy.upsert.mockResolvedValue({ id: 'policy-1' });
        dbMocks.client.app.update.mockResolvedValue({ id: 'app-1' });
        dbMocks.client.appNetworkPolicy.update.mockResolvedValue({ id: 'policy-1' });
        dbMocks.client.appNetworkPolicyRule.findFirst.mockImplementation(({ where }: { where: { id?: string | { not: string } } }) => {
            if (where.id && typeof where.id === 'object') {
                return Promise.resolve(null);
            }
            if (where.id) {
                return Promise.resolve({ id: where.id });
            }
            return Promise.resolve(null);
        });
        dbMocks.client.appNetworkPolicyRule.create.mockResolvedValue({ id: 'rule-created' });
        dbMocks.client.appNetworkPolicyRule.update.mockResolvedValue({ id: 'rule-keep' });
        dbMocks.client.appNetworkPolicyRule.deleteMany.mockResolvedValue({ count: 1 });
        dbMocks.client.appNetworkPolicyRule.findMany.mockResolvedValue([]);
        mirrorServiceMocks.mirrorAppConfigurationSave.mockResolvedValue([]);
        mirrorServiceMocks.unmirrorAppRules.mockResolvedValue([]);
    });

    it('persists settings and reconciles the full rule set in one transaction', async () => {
        await appNetworkPolicyService.savePolicyConfiguration({
            appId: 'app-1',
            useNetworkPolicy: false,
            allowInternetAccess: true,
            rules: [
                { type: 'INGRESS', targetType: 'APP', targetId: 'app-2', port: 8080, protocol: 'TCP' },
                { id: 'rule-keep', type: 'EGRESS', targetType: 'APP', targetId: 'app-3', port: 443, protocol: 'TCP' },
            ],
        });

        expect(dbMocks.client.appNetworkPolicy.upsert).toHaveBeenCalledWith({
            where: { appId: 'app-1' },
            create: { appId: 'app-1' },
            update: {},
        });
        expect(dbMocks.client.app.update).toHaveBeenCalledWith({
            where: { id: 'app-1' },
            data: { useNetworkPolicy: false },
        });
        expect(dbMocks.client.appNetworkPolicy.update).toHaveBeenCalledWith({
            where: { id: 'policy-1' },
            data: { allowInternetAccess: true },
        });

        expect(dbMocks.client.appNetworkPolicyRule.create).toHaveBeenCalledWith({
            data: {
                targetAppId: 'app-2',
                type: 'INGRESS',
                port: 8080,
                protocol: 'TCP',
                appNetworkPolicyId: 'policy-1',
            },
        });
        expect(dbMocks.client.appNetworkPolicyRule.update).toHaveBeenCalledWith({
            where: { id: 'rule-keep' },
            data: expect.objectContaining({
                targetAppId: 'app-3',
                type: 'EGRESS',
                port: 443,
                protocol: 'TCP',
            }),
        });
        // a rule that is no longer part of the submitted set is removed
        expect(dbMocks.client.appNetworkPolicyRule.deleteMany).toHaveBeenCalledWith({
            where: {
                appNetworkPolicyId: 'policy-1',
                id: { notIn: ['rule-created', 'rule-keep'] },
            },
        });
        expect(revalidateTag).toHaveBeenCalledWith('app-app-1');
        expect(revalidateTag).toHaveBeenCalledWith('apps-project-1');
        expect(revalidateTag).toHaveBeenCalledWith('app-app-2');
        expect(revalidateTag).toHaveBeenCalledWith('apps-project-app-2');
        expect(revalidateTag).toHaveBeenCalledWith('app-app-3');
        expect(revalidateTag).toHaveBeenCalledWith('apps-project-app-3');
    });

    it('removes mirrored counterparts when a rule is dropped from a saved rule set', async () => {
        dbMocks.client.appNetworkPolicyRule.findMany.mockResolvedValue([
            { type: 'EGRESS', targetAppId: 'app-3', targetAgentId: null, port: 443, protocol: 'TCP' },
            { type: 'INGRESS', targetAppId: 'app-2', targetAgentId: null, port: 8080, protocol: 'TCP' },
        ]);
        const session = { userGroup: { name: 'admin' } } as any;

        await appNetworkPolicyService.savePolicyConfiguration({
            appId: 'app-1',
            useNetworkPolicy: true,
            allowInternetAccess: true,
            rules: [
                { id: 'rule-keep', type: 'INGRESS', targetType: 'APP', targetId: 'app-2', port: 8080, protocol: 'TCP' },
            ],
        }, session);

        expect(mirrorServiceMocks.unmirrorAppRules).toHaveBeenCalledWith(
            dbMocks.client,
            session,
            'app-1',
            [{ type: 'EGRESS', targetAppId: 'app-3', targetAgentId: null, port: 443, protocol: 'TCP' }],
        );
        expect(mirrorServiceMocks.mirrorAppConfigurationSave).toHaveBeenCalledWith(
            dbMocks.client,
            session,
            'app-1',
            [{ id: 'rule-keep', type: 'INGRESS', targetType: 'APP', targetId: 'app-2', port: 8080, protocol: 'TCP' }],
        );
    });

    it('revalidates counterpart agents and their project lists', async () => {
        await appNetworkPolicyService.savePolicyConfiguration({
            appId: 'app-1',
            useNetworkPolicy: true,
            allowInternetAccess: true,
            rules: [{ type: 'INGRESS', targetType: 'AGENT', targetId: 'agent-2', port: 8080, protocol: 'TCP' }],
        });

        expect(revalidateTag).toHaveBeenCalledWith('agent-agent-2');
        expect(revalidateTag).toHaveBeenCalledWith('agents-project-agent-2');
    });

    it('rejects a rule referencing the app itself', async () => {
        await expect(appNetworkPolicyService.savePolicyConfiguration({
            appId: 'app-1',
            useNetworkPolicy: true,
            allowInternetAccess: true,
            rules: [
                { type: 'EGRESS', targetType: 'APP', targetId: 'app-1', port: 80, protocol: 'TCP' },
            ],
        })).rejects.toThrow('An app cannot reference itself.');
    });
});
