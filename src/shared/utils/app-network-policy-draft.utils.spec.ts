import type { AppExtendedModel } from '@/shared/model/app-extended.model';
import { AppNetworkPolicyDraftUtils } from './app-network-policy-draft.utils';

function app(): AppExtendedModel {
    return {
        id: 'app-a',
        projectId: 'project-a',
        useNetworkPolicy: true,
        appDomains: [],
        appNetworkPolicy: {
            allowInternetAccess: false,
            rules: [{
                id: 'rule-a',
                type: 'EGRESS',
                targetAppId: 'app-b',
                targetAgentId: null,
                targetApp: { id: 'app-b', name: 'App B', projectId: 'project-a' },
                targetAgent: null,
                port: 443,
                protocol: 'TCP',
            }],
        },
    } as unknown as AppExtendedModel;
}

describe('AppNetworkPolicyDraftUtils', () => {
    test('round trips a persisted configuration without draft metadata', () => {
        const draft = AppNetworkPolicyDraftUtils.fromApp(app());

        expect(AppNetworkPolicyDraftUtils.toConfiguration(draft)).toEqual({
            appId: 'app-a',
            useNetworkPolicy: true,
            allowInternetAccess: false,
            rules: [{
                id: 'rule-a',
                type: 'EGRESS',
                targetType: 'APP',
                targetId: 'app-b',
                port: 443,
                protocol: 'TCP',
            }],
        });
    });

    test('compares canonical content independent of order and technical ids', () => {
        const left = AppNetworkPolicyDraftUtils.addRule(AppNetworkPolicyDraftUtils.fromApp(app()), {
            type: 'INGRESS', targetType: 'APP', targetId: 'app-c', port: 80, protocol: 'TCP',
        });
        const right = {
            ...left,
            rules: [...left.rules].reverse().map(rule => ({ ...rule, id: 'different', key: `other:${rule.key}`, persistedId: 'different' })),
        };

        expect(AppNetworkPolicyDraftUtils.equals(left, right)).toBe(true);
    });

    test('changes the snapshot key when persisted ids arrive after a save', () => {
        const beforeSave = app();
        beforeSave.appNetworkPolicy!.rules[0].id = 'draft:rule';
        const afterSave = app();

        expect(AppNetworkPolicyDraftUtils.snapshotKey([beforeSave]))
            .not.toBe(AppNetworkPolicyDraftUtils.snapshotKey([afterSave]));
    });

    test('removes exactly the rules named by connection provenance', () => {
        const draftA = AppNetworkPolicyDraftUtils.fromApp(app());
        const draftB = AppNetworkPolicyDraftUtils.addRule({ ...draftA, appId: 'app-b', rules: [] }, {
            type: 'INGRESS', targetType: 'APP', targetId: 'app-a', port: 443, protocol: 'TCP',
        });
        const result = AppNetworkPolicyDraftUtils.removeProvenance({ 'app-a': draftA, 'app-b': draftB }, [
            { ownerAppId: 'app-a', ruleKey: draftA.rules[0].key },
            { ownerAppId: 'app-b', ruleKey: draftB.rules[0].key },
        ]);

        expect(result['app-a'].rules).toEqual([]);
        expect(result['app-b'].rules).toEqual([]);
    });
});
