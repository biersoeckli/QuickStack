import type { AppNetworkPolicyRuleEditModel } from '@/shared/model/app-network-policy-edit.model';

/** Identity of a network policy rule: the connection it allows, independent of server metadata. */
export type NetworkPolicyRuleContent = {
    type: 'INGRESS' | 'EGRESS';
    targetAppId: string | null;
    targetAgentId: string | null;
    port: number;
    protocol: string;
};

export class NetworkPolicyRuleUtils {
    static opposite(type: 'INGRESS' | 'EGRESS'): 'INGRESS' | 'EGRESS' {
        return type === 'INGRESS' ? 'EGRESS' : 'INGRESS';
    }

    static fromStoredRule(rule: {
        type: string;
        targetAppId: string | null;
        targetAgentId: string | null;
        port: number;
        protocol: string;
    }): NetworkPolicyRuleContent {
        return {
            type: rule.type as 'INGRESS' | 'EGRESS',
            targetAppId: rule.targetAppId,
            targetAgentId: rule.targetAgentId,
            port: rule.port,
            protocol: rule.protocol,
        };
    }

    static fromEditRule(rule: Pick<AppNetworkPolicyRuleEditModel, 'type' | 'targetType' | 'targetId' | 'port' | 'protocol'>): NetworkPolicyRuleContent {
        return {
            type: rule.type,
            targetAppId: rule.targetType === 'APP' ? rule.targetId : null,
            targetAgentId: rule.targetType === 'AGENT' ? rule.targetId : null,
            port: rule.port,
            protocol: rule.protocol,
        };
    }

    static hasSameContent(a: NetworkPolicyRuleContent, b: NetworkPolicyRuleContent): boolean {
        return a.type === b.type
            && a.targetAppId === b.targetAppId
            && a.targetAgentId === b.targetAgentId
            && a.port === b.port
            && a.protocol === b.protocol;
    }

    static contentSignature(content: NetworkPolicyRuleContent): string {
        return `${content.type}|${content.targetAppId ?? ''}|${content.targetAgentId ?? ''}|${content.port}|${content.protocol}`;
    }
}
