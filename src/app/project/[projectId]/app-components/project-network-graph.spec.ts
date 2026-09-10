
import type { AppExtendedModel } from '@/shared/model/app-extended.model';
import { buildProjectNetworkGraph, connectionDeletionProvenance } from './project-network-graph/project-network-graph-projection';
import { graphEdgePresentation } from './project-network-graph/project-network-graph-visual-semantics';

function app(overrides: Record<string, unknown> = {}): AppExtendedModel {
    return {
        id: 'app-a', name: 'App A', projectId: 'project-a', useNetworkPolicy: true,
        appDomains: [], appNetworkPolicy: { allowInternetAccess: false, rules: [] },
        ...overrides,
    } as unknown as AppExtendedModel;
}

describe('buildProjectNetworkGraph', () => {
    test('renders one dashed connection when ingress and egress ports do not match', () => {
        const graph = buildProjectNetworkGraph([
            app({ appNetworkPolicy: { allowInternetAccess: false, rules: [
                { type: 'EGRESS', port: 443, protocol: 'TCP', targetApp: { id: 'app-b', name: 'App B', projectId: 'project-a' } },
                { type: 'EGRESS', port: 80, protocol: 'TCP', targetApp: { id: 'app-b', name: 'App B', projectId: 'project-a' } },
            ] } }),
            app({ id: 'app-b', name: 'App B', appNetworkPolicy: { allowInternetAccess: false, rules: [
                { type: 'INGRESS', port: 8080, protocol: 'TCP', targetApp: { id: 'app-a', name: 'App A', projectId: 'project-a' } },
            ] } }),
        ]);

        expect(graph.edges).toEqual([expect.objectContaining({ source: 'APP:app-a', target: 'APP:app-b', direction: 'CONNECTION', labels: ['80/TCP', '443/TCP', '8080/TCP'], complete: false })]);
    });

    test('renders one complete connection when ingress and egress match', () => {
        const graph = buildProjectNetworkGraph([
            app({ appNetworkPolicy: { allowInternetAccess: false, rules: [{ type: 'EGRESS', port: 3306, protocol: 'TCP', targetApp: { id: 'app-b', name: 'App B', projectId: 'project-a' } }] } }),
            app({ id: 'app-b', name: 'App B', appNetworkPolicy: { allowInternetAccess: false, rules: [{ type: 'INGRESS', port: 3306, protocol: 'TCP', targetApp: { id: 'app-a', name: 'App A', projectId: 'project-a' } }] } }),
        ]);
        expect(graph.edges).toEqual([expect.objectContaining({ source: 'APP:app-a', target: 'APP:app-b', direction: 'CONNECTION', labels: ['3306/TCP'], complete: true })]);
    });

    test('retains the owning App and rule id through connection consolidation', () => {
        const graph = buildProjectNetworkGraph([
            app({ appNetworkPolicy: { allowInternetAccess: false, rules: [{ id: 'egress-a', type: 'EGRESS', port: 443, protocol: 'TCP', targetApp: { id: 'app-b', name: 'App B', projectId: 'project-a' } }] } }),
            app({ id: 'app-b', name: 'App B', appNetworkPolicy: { allowInternetAccess: false, rules: [{ id: 'ingress-b', type: 'INGRESS', port: 443, protocol: 'TCP', targetApp: { id: 'app-a', name: 'App A', projectId: 'project-a' } }] } }),
        ]);

        expect(graph.edges[0].ruleProvenance).toEqual([
            { ownerAppId: 'app-b', ruleKey: 'ingress-b' },
            { ownerAppId: 'app-a', ruleKey: 'egress-a' },
        ]);
        expect(connectionDeletionProvenance(graph.edges[0], new Set(['app-a']))).toBeUndefined();
        expect(connectionDeletionProvenance(graph.edges[0], new Set(['app-a', 'app-b'])))
            .toEqual(graph.edges[0].ruleProvenance);
    });

    test('uses the rule owner rather than the traffic source for ingress-only deletion rights', () => {
        const graph = buildProjectNetworkGraph([
            app(),
            app({ id: 'app-b', name: 'App B', appNetworkPolicy: { allowInternetAccess: false, rules: [{ id: 'ingress-b', type: 'INGRESS', port: 443, protocol: 'TCP', targetApp: { id: 'app-a', name: 'App A', projectId: 'project-a' } }] } }),
        ]);

        expect(connectionDeletionProvenance(graph.edges[0], new Set(['app-a']))).toBeUndefined();
        expect(connectionDeletionProvenance(graph.edges[0], new Set(['app-b'])))
            .toEqual([{ ownerAppId: 'app-b', ruleKey: 'ingress-b' }]);
    });

    test('adds internet and external App and Agent targets', () => {
        const graph = buildProjectNetworkGraph([app({
            appDomains: [{ hostname: 'example.test', port: 3000 }],
            appNetworkPolicy: { allowInternetAccess: true, rules: [
                { type: 'EGRESS', port: 5432, protocol: 'TCP', targetApp: { id: 'external-app', name: 'External App', projectId: 'project-b' } },
                { type: 'EGRESS', port: 8080, protocol: 'TCP', targetAgent: { id: 'agent-a', name: 'Agent A', projectId: 'project-b' } },
            ] },
        })]);

        expect(graph.nodes).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: 'INTERNET', kind: 'INTERNET' }),
            expect.objectContaining({ id: 'APP:external-app', external: true, caption: 'Other project' }),
            expect.objectContaining({ id: 'AGENT:agent-a', external: true, caption: 'Other project' }),
        ]));
        expect(graph.edges).toEqual(expect.arrayContaining([
            expect.objectContaining({
                source: 'APP:app-a', target: 'INTERNET', direction: 'INTERNET_CONNECTION',
                labels: ['example.test:3000'], internetIngress: true, internetEgress: true,
            }),
        ]));
        const internetConnection = graph.edges.find(edge => edge.direction === 'INTERNET_CONNECTION');
        expect(graphEdgePresentation(internetConnection!)).toMatchObject({ sourceHandle: 'source-internet', targetHandle: 'target', dashed: false });
    });

    test('omits policy rules and egress but retains effective App Domain ingress when the policy is disabled', () => {
        const graph = buildProjectNetworkGraph([app({
            useNetworkPolicy: false,
            appDomains: [{ hostname: 'hidden.test', port: 3000 }],
            appNetworkPolicy: { allowInternetAccess: true, rules: [{ type: 'EGRESS', port: 80, protocol: 'TCP', targetApp: { id: 'app-b', name: 'App B', projectId: 'project-a' } }] },
        })]);
        expect(graph.nodes).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'APP:app-a' }), expect.objectContaining({ id: 'INTERNET' })]));
        expect(graph.edges).toEqual([expect.objectContaining({
            source: 'APP:app-a', target: 'INTERNET', direction: 'INTERNET_CONNECTION', labels: ['hidden.test:3000'],
            internetIngress: true, internetEgress: false,
        })]);
    });
});
