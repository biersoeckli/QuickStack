import { UserSession } from '@/shared/model/sim-session.model';
import networkPolicyRuleMirrorService from './network-policy-rule-mirror.service';

const adminSession = { userGroup: { name: 'admin' } } as unknown as UserSession;
const noAccessSession = { userGroup: { name: 'viewer', roleProjectPermissions: [] } } as unknown as UserSession;

function createDb() {
    return {
        app: { findUnique: vi.fn() },
        appNetworkPolicy: { upsert: vi.fn(), findUnique: vi.fn() },
        appNetworkPolicyRule: { findFirst: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
        agent: { findUnique: vi.fn() },
        agentNetworkPolicyRule: { findFirst: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
    };
}

describe('network-policy-rule-mirror.service', () => {
    it('creates an INGRESS rule on the peer App for an App EGRESS rule', async () => {
        const db = createDb();
        db.app.findUnique.mockResolvedValue({ id: 'app-b', projectId: 'project-b', useNetworkPolicy: true });
        db.appNetworkPolicy.upsert.mockResolvedValue({ id: 'policy-b' });
        db.appNetworkPolicyRule.findFirst.mockResolvedValue(null);
        db.appNetworkPolicyRule.create.mockResolvedValue({ id: 'rule-1' });

        const touches = await networkPolicyRuleMirrorService.mirrorAppConfigurationSave(
            db as never, adminSession, 'app-a',
            [{ type: 'EGRESS', targetType: 'APP', targetId: 'app-b', port: 8080, protocol: 'TCP' }],
        );

        expect(touches).toEqual([{ workloadType: 'APP', workloadId: 'app-b', projectId: 'project-b' }]);
        expect(db.appNetworkPolicyRule.create).toHaveBeenCalledWith({
            data: {
                appNetworkPolicyId: 'policy-b',
                type: 'INGRESS',
                targetAppId: 'app-a',
                targetAgentId: null,
                port: 8080,
                protocol: 'TCP',
            },
        });
    });

    it('creates an EGRESS rule on the peer App for an App INGRESS rule', async () => {
        const db = createDb();
        db.app.findUnique.mockResolvedValue({ id: 'app-b', projectId: 'project-b', useNetworkPolicy: true });
        db.appNetworkPolicy.upsert.mockResolvedValue({ id: 'policy-b' });
        db.appNetworkPolicyRule.findFirst.mockResolvedValue(null);
        db.appNetworkPolicyRule.create.mockResolvedValue({ id: 'rule-1' });

        await networkPolicyRuleMirrorService.mirrorAppConfigurationSave(
            db as never, adminSession, 'app-a',
            [{ type: 'INGRESS', targetType: 'APP', targetId: 'app-b', port: 443, protocol: 'TCP' }],
        );

        expect(db.appNetworkPolicyRule.create).toHaveBeenCalledWith({
            data: {
                appNetworkPolicyId: 'policy-b',
                type: 'EGRESS',
                targetAppId: 'app-a',
                targetAgentId: null,
                port: 443,
                protocol: 'TCP',
            },
        });
    });

    it('skips an existing counterpart rule', async () => {
        const db = createDb();
        db.app.findUnique.mockResolvedValue({ id: 'app-b', projectId: 'project-b', useNetworkPolicy: true });
        db.appNetworkPolicy.upsert.mockResolvedValue({ id: 'policy-b' });
        db.appNetworkPolicyRule.findFirst.mockResolvedValue({ id: 'existing' });

        const touches = await networkPolicyRuleMirrorService.mirrorAppConfigurationSave(
            db as never, adminSession, 'app-a',
            [{ type: 'EGRESS', targetType: 'APP', targetId: 'app-b', port: 8080, protocol: 'TCP' }],
        );

        expect(touches).toEqual([]);
        expect(db.appNetworkPolicyRule.create).not.toHaveBeenCalled();
    });

    it('does not mirror onto an App with network policies disabled', async () => {
        const db = createDb();
        db.app.findUnique.mockResolvedValue({ id: 'app-b', projectId: 'project-b', useNetworkPolicy: false });

        const touches = await networkPolicyRuleMirrorService.mirrorAppConfigurationSave(
            db as never, adminSession, 'app-a',
            [{ type: 'EGRESS', targetType: 'APP', targetId: 'app-b', port: 8080, protocol: 'TCP' }],
        );

        expect(touches).toEqual([]);
        expect(db.appNetworkPolicy.upsert).not.toHaveBeenCalled();
        expect(db.appNetworkPolicyRule.create).not.toHaveBeenCalled();
    });

    it('rejects mirroring onto an App the session cannot write', async () => {
        const db = createDb();
        db.app.findUnique.mockResolvedValue({ id: 'app-b', projectId: 'project-b', useNetworkPolicy: true });

        await expect(networkPolicyRuleMirrorService.mirrorAppConfigurationSave(
            db as never, noAccessSession, 'app-a',
            [{ type: 'EGRESS', targetType: 'APP', targetId: 'app-b', port: 8080, protocol: 'TCP' }],
        )).rejects.toThrow('You are not authorized to modify the referenced app network policy.');

        expect(db.appNetworkPolicyRule.create).not.toHaveBeenCalled();
    });

    it('creates an EGRESS rule on an Agent that is the source of an App INGRESS rule', async () => {
        const db = createDb();
        db.agent.findUnique.mockResolvedValue({
            id: 'agent-x',
            projectId: 'agent-project',
            agentNetworkPolicy: { id: 'agent-policy' },
        });
        db.agentNetworkPolicyRule.findFirst.mockResolvedValue(null);
        db.agentNetworkPolicyRule.create.mockResolvedValue({ id: 'rule-1' });

        const touches = await networkPolicyRuleMirrorService.mirrorAppConfigurationSave(
            db as never, adminSession, 'app-a',
            [{ type: 'INGRESS', targetType: 'AGENT', targetId: 'agent-x', port: 443, protocol: 'TCP' }],
        );

        expect(touches).toEqual([{ workloadType: 'AGENT', workloadId: 'agent-x', projectId: 'agent-project' }]);
        expect(db.agentNetworkPolicyRule.create).toHaveBeenCalledWith({
            data: {
                agentNetworkPolicyId: 'agent-policy',
                type: 'EGRESS',
                targetAppId: 'app-a',
                port: 443,
                protocol: 'TCP',
            },
        });
    });

    it('does not mirror to an Agent without an active network policy', async () => {
        const db = createDb();
        db.agent.findUnique.mockResolvedValue({
            id: 'agent-x',
            projectId: 'agent-project',
            agentNetworkPolicy: null,
        });

        const touches = await networkPolicyRuleMirrorService.mirrorAppConfigurationSave(
            db as never, adminSession, 'app-a',
            [{ type: 'INGRESS', targetType: 'AGENT', targetId: 'agent-x', port: 443, protocol: 'TCP' }],
        );

        expect(touches).toEqual([]);
        expect(db.agentNetworkPolicyRule.create).not.toHaveBeenCalled();
    });

    it('does not mirror an App EGRESS rule to an Agent (no ingress counterpart exists)', async () => {
        const db = createDb();

        const touches = await networkPolicyRuleMirrorService.mirrorAppConfigurationSave(
            db as never, adminSession, 'app-a',
            [{ type: 'EGRESS', targetType: 'AGENT', targetId: 'agent-x', port: 443, protocol: 'TCP' }],
        );

        expect(touches).toEqual([]);
        expect(db.agent.findUnique).not.toHaveBeenCalled();
        expect(db.agentNetworkPolicyRule.create).not.toHaveBeenCalled();
    });

    it('creates an INGRESS rule on the target App for an Agent EGRESS rule', async () => {
        const db = createDb();
        db.app.findUnique.mockResolvedValue({ id: 'app-b', projectId: 'project-b', useNetworkPolicy: true });
        db.appNetworkPolicy.upsert.mockResolvedValue({ id: 'policy-b' });
        db.appNetworkPolicyRule.findFirst.mockResolvedValue(null);
        db.appNetworkPolicyRule.create.mockResolvedValue({ id: 'rule-1' });

        const touches = await networkPolicyRuleMirrorService.mirrorAgentEgressRuleSave(
            db as never, adminSession, 'app-b', 'agent-x', 8080, 'TCP',
        );

        expect(touches).toEqual([{ workloadType: 'APP', workloadId: 'app-b', projectId: 'project-b' }]);
        expect(db.appNetworkPolicyRule.create).toHaveBeenCalledWith({
            data: {
                appNetworkPolicyId: 'policy-b',
                type: 'INGRESS',
                targetAppId: null,
                targetAgentId: 'agent-x',
                port: 8080,
                protocol: 'TCP',
            },
        });
    });

    it('returns no touches when no session is provided', async () => {
        const db = createDb();
        const touches = await networkPolicyRuleMirrorService.mirrorAppConfigurationSave(
            db as never, null, 'app-a',
            [{ type: 'EGRESS', targetType: 'APP', targetId: 'app-b', port: 8080, protocol: 'TCP' }],
        );
        expect(touches).toEqual([]);
        expect(db.app.findUnique).not.toHaveBeenCalled();
    });

    it('removes the peer App INGRESS counterpart of a removed App EGRESS rule', async () => {
        const db = createDb();
        db.app.findUnique.mockResolvedValue({ id: 'app-b', projectId: 'project-b', useNetworkPolicy: true });
        db.appNetworkPolicy.findUnique.mockResolvedValue({ id: 'policy-b' });
        db.appNetworkPolicyRule.deleteMany.mockResolvedValue({ count: 1 });

        const touches = await networkPolicyRuleMirrorService.unmirrorAppRules(
            db as never, adminSession, 'app-a',
            [{ type: 'EGRESS', targetAppId: 'app-b', targetAgentId: null, port: 8080, protocol: 'TCP' }],
        );

        expect(touches).toEqual([{ workloadType: 'APP', workloadId: 'app-b', projectId: 'project-b' }]);
        expect(db.appNetworkPolicyRule.deleteMany).toHaveBeenCalledWith({
            where: {
                appNetworkPolicyId: 'policy-b',
                type: 'INGRESS',
                targetAppId: 'app-a',
                targetAgentId: null,
                port: 8080,
                protocol: 'TCP',
            },
        });
    });

    it('removes the peer App EGRESS counterpart of a removed App INGRESS rule', async () => {
        const db = createDb();
        db.app.findUnique.mockResolvedValue({ id: 'app-b', projectId: 'project-b', useNetworkPolicy: true });
        db.appNetworkPolicy.findUnique.mockResolvedValue({ id: 'policy-b' });
        db.appNetworkPolicyRule.deleteMany.mockResolvedValue({ count: 1 });

        const touches = await networkPolicyRuleMirrorService.unmirrorAppRules(
            db as never, adminSession, 'app-a',
            [{ type: 'INGRESS', targetAppId: 'app-b', targetAgentId: null, port: 443, protocol: 'TCP' }],
        );

        expect(touches).toEqual([{ workloadType: 'APP', workloadId: 'app-b', projectId: 'project-b' }]);
        expect(db.appNetworkPolicyRule.deleteMany).toHaveBeenCalledWith({
            where: {
                appNetworkPolicyId: 'policy-b',
                type: 'EGRESS',
                targetAppId: 'app-a',
                targetAgentId: null,
                port: 443,
                protocol: 'TCP',
            },
        });
    });

    it('removes the Agent EGRESS counterpart of a removed App INGRESS-from-Agent rule', async () => {
        const db = createDb();
        db.agent.findUnique.mockResolvedValue({
            id: 'agent-x',
            projectId: 'agent-project',
            agentNetworkPolicy: { id: 'agent-policy' },
        });
        db.agentNetworkPolicyRule.deleteMany.mockResolvedValue({ count: 1 });

        const touches = await networkPolicyRuleMirrorService.unmirrorAppRules(
            db as never, adminSession, 'app-a',
            [{ type: 'INGRESS', targetAppId: null, targetAgentId: 'agent-x', port: 443, protocol: 'TCP' }],
        );

        expect(touches).toEqual([{ workloadType: 'AGENT', workloadId: 'agent-x', projectId: 'agent-project' }]);
        expect(db.agentNetworkPolicyRule.deleteMany).toHaveBeenCalledWith({
            where: {
                agentNetworkPolicyId: 'agent-policy',
                type: 'EGRESS',
                targetAppId: 'app-a',
                port: 443,
                protocol: 'TCP',
            },
        });
    });

    it('does not remove a counterpart from an App with network policies disabled', async () => {
        const db = createDb();
        db.app.findUnique.mockResolvedValue({ id: 'app-b', projectId: 'project-b', useNetworkPolicy: false });

        const touches = await networkPolicyRuleMirrorService.unmirrorAppRules(
            db as never, adminSession, 'app-a',
            [{ type: 'EGRESS', targetAppId: 'app-b', targetAgentId: null, port: 8080, protocol: 'TCP' }],
        );

        expect(touches).toEqual([]);
        expect(db.appNetworkPolicyRule.deleteMany).not.toHaveBeenCalled();
    });

    it('rejects counterpart removal from a peer the session cannot write', async () => {
        const db = createDb();
        db.app.findUnique.mockResolvedValue({ id: 'app-b', projectId: 'project-b', useNetworkPolicy: true });

        await expect(networkPolicyRuleMirrorService.unmirrorAppRules(
            db as never, noAccessSession, 'app-a',
            [{ type: 'EGRESS', targetAppId: 'app-b', targetAgentId: null, port: 8080, protocol: 'TCP' }],
        )).rejects.toThrow('You are not authorized to modify the referenced app network policy.');

        expect(db.appNetworkPolicyRule.deleteMany).not.toHaveBeenCalled();
    });

    it('returns no touch when no counterpart rule is deleted', async () => {
        const db = createDb();
        db.app.findUnique.mockResolvedValue({ id: 'app-b', projectId: 'project-b', useNetworkPolicy: true });
        db.appNetworkPolicy.findUnique.mockResolvedValue({ id: 'policy-b' });
        db.appNetworkPolicyRule.deleteMany.mockResolvedValue({ count: 0 });

        const touches = await networkPolicyRuleMirrorService.unmirrorAppRules(
            db as never, adminSession, 'app-a',
            [{ type: 'EGRESS', targetAppId: 'app-b', targetAgentId: null, port: 8080, protocol: 'TCP' }],
        );

        expect(touches).toEqual([]);
    });

    it('removes the INGRESS counterpart on the target App of a deleted Agent EGRESS rule', async () => {
        const db = createDb();
        db.app.findUnique.mockResolvedValue({ id: 'app-b', projectId: 'project-b', useNetworkPolicy: true });
        db.appNetworkPolicy.findUnique.mockResolvedValue({ id: 'policy-b' });
        db.appNetworkPolicyRule.deleteMany.mockResolvedValue({ count: 1 });

        const touches = await networkPolicyRuleMirrorService.unmirrorAgentEgressRule(
            db as never, adminSession, 'agent-x', 'app-b', 8080, 'TCP',
        );

        expect(touches).toEqual([{ workloadType: 'APP', workloadId: 'app-b', projectId: 'project-b' }]);
        expect(db.appNetworkPolicyRule.deleteMany).toHaveBeenCalledWith({
            where: {
                appNetworkPolicyId: 'policy-b',
                type: 'INGRESS',
                targetAppId: null,
                targetAgentId: 'agent-x',
                port: 8080,
                protocol: 'TCP',
            },
        });
    });
});
