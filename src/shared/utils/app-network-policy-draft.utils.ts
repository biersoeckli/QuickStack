import type { AppExtendedModel, AppNetworkPolicyRuleWithTargetAppModel } from '@/shared/model/app-extended.model';
import type {
    AppNetworkPolicyConfigurationModel,
    AppNetworkPolicyRuleEditModel,
    NetworkPolicySelectableTarget,
} from '@/shared/model/app-network-policy-edit.model';
import { NetworkPolicyRuleUtils } from './network-policy-rule.utils';

export type AppNetworkPolicyRuleDraft = AppNetworkPolicyRuleEditModel & {
    key: string;
    persistedId?: string;
    targetName: string;
    targetProjectId: string;
};

export type AppNetworkPolicyDraft = Omit<AppNetworkPolicyConfigurationModel, 'rules'> & {
    rules: AppNetworkPolicyRuleDraft[];
};

export type AppNetworkPolicyRuleProvenance = {
    ownerAppId: string;
    ruleKey: string;
};

function ruleKey(rule: Pick<AppNetworkPolicyRuleEditModel, 'type' | 'targetType' | 'targetId' | 'port' | 'protocol'>) {
    return `draft:${NetworkPolicyRuleUtils.contentSignature(NetworkPolicyRuleUtils.fromEditRule(rule))}`;
}

export class AppNetworkPolicyDraftUtils {
    static fromApp(app: AppExtendedModel): AppNetworkPolicyDraft {
        return {
            appId: app.id,
            useNetworkPolicy: app.useNetworkPolicy,
            allowInternetAccess: app.appNetworkPolicy?.allowInternetAccess !== false,
            rules: (app.appNetworkPolicy?.rules ?? []).flatMap(rule => {
                const target = rule.targetApp ?? rule.targetAgent;
                const targetId = rule.targetAppId ?? rule.targetAgentId;
                if (!targetId) return [];

                return [{
                    id: rule.id,
                    key: rule.id,
                    persistedId: rule.id,
                    type: rule.type as 'INGRESS' | 'EGRESS',
                    targetType: rule.targetAppId ? 'APP' : 'AGENT',
                    targetId,
                    targetName: target?.name ?? 'Unknown target',
                    targetProjectId: target?.projectId ?? '',
                    port: rule.port,
                    protocol: rule.protocol as 'TCP' | 'UDP',
                }];
            }),
        };
    }

    static collectionFromApps(apps: AppExtendedModel[]): Record<string, AppNetworkPolicyDraft> {
        return Object.fromEntries(apps.map(app => [app.id, this.fromApp(app)]));
    }

    static snapshotKey(apps: AppExtendedModel[]): string {
        return apps.map(app => {
            const persistedRuleIds = (app.appNetworkPolicy?.rules ?? []).map(rule => rule.id).sort();
            return [this.contentKey(this.fromApp(app)), ...persistedRuleIds].join(':');
        }).sort().join('|');
    }

    static contentKey(draft: AppNetworkPolicyDraft): string {
        const rules = draft.rules
            .map(rule => NetworkPolicyRuleUtils.contentSignature(NetworkPolicyRuleUtils.fromEditRule(rule)))
            .sort();
        return [draft.appId, draft.useNetworkPolicy, draft.allowInternetAccess, ...rules].join(':');
    }

    static equals(left: AppNetworkPolicyDraft, right: AppNetworkPolicyDraft): boolean {
        return this.contentKey(left) === this.contentKey(right);
    }

    static addRule(
        draft: AppNetworkPolicyDraft,
        rule: AppNetworkPolicyRuleEditModel,
        target?: NetworkPolicySelectableTarget,
    ): AppNetworkPolicyDraft {
        return {
            ...draft,
            useNetworkPolicy: true,
            rules: [...draft.rules, {
                ...rule,
                key: ruleKey(rule),
                persistedId: rule.id,
                targetName: target?.name ?? 'Unknown target',
                targetProjectId: target?.project.id ?? '',
            }],
        };
    }

    static removeRule(draft: AppNetworkPolicyDraft, key: string): AppNetworkPolicyDraft {
        return { ...draft, rules: draft.rules.filter(rule => rule.key !== key) };
    }

    static removeProvenance(
        drafts: Record<string, AppNetworkPolicyDraft>,
        provenance: AppNetworkPolicyRuleProvenance[],
    ): Record<string, AppNetworkPolicyDraft> {
        const keysByOwner = new Map<string, Set<string>>();
        for (const item of provenance) {
            const keys = keysByOwner.get(item.ownerAppId) ?? new Set<string>();
            keys.add(item.ruleKey);
            keysByOwner.set(item.ownerAppId, keys);
        }

        return Object.fromEntries(Object.entries(drafts).map(([appId, draft]) => {
            const keys = keysByOwner.get(appId);
            return [appId, keys ? { ...draft, rules: draft.rules.filter(rule => !keys.has(rule.key)) } : draft];
        }));
    }

    static toConfiguration(draft: AppNetworkPolicyDraft): AppNetworkPolicyConfigurationModel {
        return {
            appId: draft.appId,
            useNetworkPolicy: draft.useNetworkPolicy,
            allowInternetAccess: draft.allowInternetAccess,
            rules: draft.rules.map(rule => ({
                ...(rule.persistedId ? { id: rule.persistedId } : {}),
                type: rule.type,
                targetType: rule.targetType,
                targetId: rule.targetId,
                port: rule.port,
                protocol: rule.protocol,
            })),
        };
    }

    static toGraphRules(draft: AppNetworkPolicyDraft): AppNetworkPolicyRuleWithTargetAppModel[] {
        return draft.rules.map(rule => ({
            id: rule.key,
            type: rule.type,
            port: rule.port,
            protocol: rule.protocol,
            targetAppId: rule.targetType === 'APP' ? rule.targetId : null,
            targetAgentId: rule.targetType === 'AGENT' ? rule.targetId : null,
            targetApp: rule.targetType === 'APP'
                ? { id: rule.targetId, name: rule.targetName, projectId: rule.targetProjectId }
                : null,
            targetAgent: rule.targetType === 'AGENT'
                ? { id: rule.targetId, name: rule.targetName, projectId: rule.targetProjectId }
                : null,
        }) as AppNetworkPolicyRuleWithTargetAppModel);
    }

    static applyToApp(app: AppExtendedModel, draft: AppNetworkPolicyDraft): AppExtendedModel {
        return {
            ...app,
            useNetworkPolicy: draft.useNetworkPolicy,
            appNetworkPolicy: {
                ...app.appNetworkPolicy,
                allowInternetAccess: draft.allowInternetAccess,
                rules: this.toGraphRules(draft),
            },
        } as AppExtendedModel;
    }
}
