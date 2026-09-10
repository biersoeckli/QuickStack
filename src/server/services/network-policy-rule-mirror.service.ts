import { Prisma } from '@prisma/client';
import { UserGroupUtils } from '@/shared/utils/role.utils';
import { UserSession } from '@/shared/model/sim-session.model';
import { AppNetworkPolicyRuleEditModel } from '@/shared/model/app-network-policy-edit.model';
import { NetworkPolicyRuleContent, NetworkPolicyRuleUtils } from '@/shared/utils/network-policy-rule.utils';
import { ServiceException } from '@/shared/model/service.exception.model';

export type NetworkPolicyMirrorTouch = {
    workloadType: 'APP' | 'AGENT';
    workloadId: string;
    projectId: string;
};

/** A counterpart row to store on (or remove from) a peer workload. */
type CounterpartRuleContent = NetworkPolicyRuleContent;

/**
 * Mirrors a saved network policy rule onto the peer workload so one side of a
 * connection does not need to be configured twice. Mirroring is best-effort: a
 * counterpart rule is added on the peer when it is missing, and a counterpart
 * matching a removed rule is deleted again. A counterpart is only touched when
 * the peer enforces network policies and the acting user may write the peer.
 * Rules whose counterpart cannot be stored (App EGRESS to an Agent) are not
 * mirrored.
 */
class NetworkPolicyRuleMirrorService {
    private static agentEgressToApp(sourceAppId: string, port: number, protocol: string): CounterpartRuleContent {
        return {
            type: 'EGRESS',
            targetAppId: sourceAppId,
            targetAgentId: null,
            port,
            protocol,
        };
    }

    private async mirrorIntoAppPeer(
        db: Prisma.TransactionClient,
        session: UserSession,
        peerAppId: string,
        content: CounterpartRuleContent,
    ): Promise<NetworkPolicyMirrorTouch | null> {
        const peer = await db.app.findUnique({
            where: { id: peerAppId },
            select: { id: true, projectId: true, useNetworkPolicy: true },
        });
        if (!peer?.useNetworkPolicy) {
            return null;
        }
        if (!UserGroupUtils.sessionHasWriteAccessForProjectWorkload(session, peerAppId)) {
            throw new ServiceException('You are not authorized to modify the referenced app network policy.');
        }

        const policy = await db.appNetworkPolicy.upsert({
            where: { appId: peer.id },
            create: { appId: peer.id },
            update: {},
        });

        const existing = await db.appNetworkPolicyRule.findFirst({
            where: { appNetworkPolicyId: policy.id, ...content },
        });
        if (existing) {
            return null;
        }

        await db.appNetworkPolicyRule.create({
            data: { appNetworkPolicyId: policy.id, ...content },
        });
        return { workloadType: 'APP', workloadId: peer.id, projectId: peer.projectId };
    }

    private async mirrorIntoAgentPolicy(
        db: Prisma.TransactionClient,
        session: UserSession,
        agentId: string,
        content: CounterpartRuleContent,
    ): Promise<NetworkPolicyMirrorTouch | null> {
        const agent = await db.agent.findUnique({
            where: { id: agentId },
            select: {
                id: true,
                projectId: true,
                agentNetworkPolicy: { select: { id: true } },
            },
        });
        if (!agent?.agentNetworkPolicy) {
            return null;
        }
        if (!UserGroupUtils.sessionHasWriteAccessForProjectWorkload(session, agentId)) {
            throw new ServiceException('You are not authorized to modify the referenced agent network policy.');
        }

        const targetAppId = content.targetAppId;
        if (!targetAppId) {
            return null;
        }

        const existing = await db.agentNetworkPolicyRule.findFirst({
            where: {
                agentNetworkPolicyId: agent.agentNetworkPolicy.id,
                type: content.type,
                targetAppId,
                port: content.port,
                protocol: content.protocol,
            },
        });
        if (existing) {
            return null;
        }

        await db.agentNetworkPolicyRule.create({
            data: {
                agentNetworkPolicyId: agent.agentNetworkPolicy.id,
                type: content.type,
                targetAppId,
                port: content.port,
                protocol: content.protocol,
            },
        });
        return { workloadType: 'AGENT', workloadId: agent.id, projectId: agent.projectId };
    }

    private async deleteAppPeerCounterpart(
        db: Prisma.TransactionClient,
        session: UserSession,
        peerAppId: string,
        content: CounterpartRuleContent,
    ): Promise<NetworkPolicyMirrorTouch | null> {
        const peer = await db.app.findUnique({
            where: { id: peerAppId },
            select: { id: true, projectId: true, useNetworkPolicy: true },
        });
        if (!peer?.useNetworkPolicy) {
            return null;
        }
        if (!UserGroupUtils.sessionHasWriteAccessForProjectWorkload(session, peerAppId)) {
            throw new ServiceException('You are not authorized to modify the referenced app network policy.');
        }

        const policy = await db.appNetworkPolicy.findUnique({
            where: { appId: peer.id },
            select: { id: true },
        });
        if (!policy) {
            return null;
        }

        const deleted = await db.appNetworkPolicyRule.deleteMany({
            where: { appNetworkPolicyId: policy.id, ...content },
        });
        return deleted.count > 0 ? { workloadType: 'APP', workloadId: peer.id, projectId: peer.projectId } : null;
    }

    private async deleteAgentPeerCounterpart(
        db: Prisma.TransactionClient,
        session: UserSession,
        agentId: string,
        content: CounterpartRuleContent,
    ): Promise<NetworkPolicyMirrorTouch | null> {
        const agent = await db.agent.findUnique({
            where: { id: agentId },
            select: {
                id: true,
                projectId: true,
                agentNetworkPolicy: { select: { id: true } },
            },
        });
        if (!agent?.agentNetworkPolicy) {
            return null;
        }
        if (!UserGroupUtils.sessionHasWriteAccessForProjectWorkload(session, agentId)) {
            throw new ServiceException('You are not authorized to modify the referenced agent network policy.');
        }

        const targetAppId = content.targetAppId;
        if (!targetAppId) {
            return null;
        }

        const deleted = await db.agentNetworkPolicyRule.deleteMany({
            where: {
                agentNetworkPolicyId: agent.agentNetworkPolicy.id,
                type: content.type,
                targetAppId,
                port: content.port,
                protocol: content.protocol,
            },
        });
        return deleted.count > 0 ? { workloadType: 'AGENT', workloadId: agent.id, projectId: agent.projectId } : null;
    }

    /**
     * Mirrors the full rule set of a saved App onto the referenced peers.
     * - App EGRESS -> peer App INGRESS from this App
     * - App INGRESS from peer App -> peer App EGRESS to this App
     * - App INGRESS from an Agent -> that Agent EGRESS to this App
     */
    async mirrorAppConfigurationSave(
        db: Prisma.TransactionClient,
        session: UserSession | null | undefined,
        sourceAppId: string,
        rules: AppNetworkPolicyRuleEditModel[],
    ): Promise<NetworkPolicyMirrorTouch[]> {
        if (!session) {
            return [];
        }

        const touches: NetworkPolicyMirrorTouch[] = [];
        for (const rule of rules) {
            const touch = rule.targetType === 'APP'
                ? await this.mirrorAppToAppPeer(db, session, sourceAppId, rule)
                : rule.type === 'INGRESS'
                    ? await this.mirrorAgentIngressToAgentPolicy(db, session, sourceAppId, rule)
                    : null;
            if (touch) {
                touches.push(touch);
            }
        }
        return touches;
    }

    /** Mirrors a saved Agent EGRESS rule (Agent -> target App) as an INGRESS rule on the target App. */
    async mirrorAgentEgressRuleSave(
        db: Prisma.TransactionClient,
        session: UserSession | null | undefined,
        targetAppId: string,
        sourceAgentId: string,
        port: number,
        protocol: string,
    ): Promise<NetworkPolicyMirrorTouch[]> {
        if (!session) {
            return [];
        }
        const content: CounterpartRuleContent = {
            type: 'INGRESS',
            targetAppId: null,
            targetAgentId: sourceAgentId,
            port,
            protocol,
        };
        const touch = await this.mirrorIntoAppPeer(db, session, targetAppId, content);
        return touch ? [touch] : [];
    }

    /**
     * Removes the mirrored counterpart of App rules that are no longer part of
     * a saved rule set. Mirrors the direction mapping of
     * {@link mirrorAppConfigurationSave}; an App EGRESS to an Agent has no
     * counterpart and is ignored.
     */
    async unmirrorAppRules(
        db: Prisma.TransactionClient,
        session: UserSession | null | undefined,
        sourceAppId: string,
        removedRules: NetworkPolicyRuleContent[],
    ): Promise<NetworkPolicyMirrorTouch[]> {
        if (!session) {
            return [];
        }

        const touches: NetworkPolicyMirrorTouch[] = [];
        for (const rule of removedRules) {
            const touch = rule.targetAppId
                ? await this.deleteAppCounterpart(db, session, sourceAppId, rule)
                : rule.type === 'INGRESS' && rule.targetAgentId
                    ? await this.deleteAgentCounterpart(db, session, sourceAppId, rule)
                    : null;
            if (touch) {
                touches.push(touch);
            }
        }
        return touches;
    }

    /** Removes the INGRESS counterpart of a deleted Agent EGRESS rule on the target App. */
    async unmirrorAgentEgressRule(
        db: Prisma.TransactionClient,
        session: UserSession | null | undefined,
        sourceAgentId: string,
        targetAppId: string,
        port: number,
        protocol: string,
    ): Promise<NetworkPolicyMirrorTouch[]> {
        if (!session) {
            return [];
        }
        const content: CounterpartRuleContent = {
            type: 'INGRESS',
            targetAppId: null,
            targetAgentId: sourceAgentId,
            port,
            protocol,
        };
        const touch = await this.deleteAppPeerCounterpart(db, session, targetAppId, content);
        return touch ? [touch] : [];
    }

    private async mirrorAppToAppPeer(
        db: Prisma.TransactionClient,
        session: UserSession,
        sourceAppId: string,
        rule: AppNetworkPolicyRuleEditModel,
    ): Promise<NetworkPolicyMirrorTouch | null> {
        if (rule.targetId === sourceAppId) {
            return null;
        }
        const content: CounterpartRuleContent = {
            type: NetworkPolicyRuleUtils.opposite(rule.type),
            targetAppId: sourceAppId,
            targetAgentId: null,
            port: rule.port,
            protocol: rule.protocol,
        };
        return this.mirrorIntoAppPeer(db, session, rule.targetId, content);
    }

    private async mirrorAgentIngressToAgentPolicy(
        db: Prisma.TransactionClient,
        session: UserSession,
        sourceAppId: string,
        rule: AppNetworkPolicyRuleEditModel,
    ): Promise<NetworkPolicyMirrorTouch | null> {
        const content = NetworkPolicyRuleMirrorService.agentEgressToApp(sourceAppId, rule.port, rule.protocol);
        return this.mirrorIntoAgentPolicy(db, session, rule.targetId, content);
    }

    private async deleteAppCounterpart(
        db: Prisma.TransactionClient,
        session: UserSession,
        sourceAppId: string,
        rule: NetworkPolicyRuleContent,
    ): Promise<NetworkPolicyMirrorTouch | null> {
        if (!rule.targetAppId) {
            return null;
        }
        const content: CounterpartRuleContent = {
            type: NetworkPolicyRuleUtils.opposite(rule.type),
            targetAppId: sourceAppId,
            targetAgentId: null,
            port: rule.port,
            protocol: rule.protocol,
        };
        return this.deleteAppPeerCounterpart(db, session, rule.targetAppId, content);
    }

    private async deleteAgentCounterpart(
        db: Prisma.TransactionClient,
        session: UserSession,
        sourceAppId: string,
        rule: NetworkPolicyRuleContent,
    ): Promise<NetworkPolicyMirrorTouch | null> {
        if (!rule.targetAgentId) {
            return null;
        }
        const content = NetworkPolicyRuleMirrorService.agentEgressToApp(sourceAppId, rule.port, rule.protocol);
        return this.deleteAgentPeerCounterpart(db, session, rule.targetAgentId, content);
    }
}

const networkPolicyRuleMirrorService = new NetworkPolicyRuleMirrorService();
export default networkPolicyRuleMirrorService;
