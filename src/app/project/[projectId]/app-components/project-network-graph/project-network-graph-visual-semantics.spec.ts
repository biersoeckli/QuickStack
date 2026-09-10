import { graphEdgePresentation } from './project-network-graph-visual-semantics';
import type { NetworkGraphEdge } from './project-network-graph-projection';

function edge(direction: NetworkGraphEdge['direction'], complete?: boolean): NetworkGraphEdge {
    return { id: direction, source: 'source', target: 'target', direction, labels: ['443/TCP'], external: false, complete };
}

describe('graphEdgePresentation', () => {
    test.each([
        ['CONNECTION', true, 'source-egress', 'target-ingress', false],
        ['CONNECTION', false, 'source-egress', 'target-ingress', true],
        ['INGRESS', undefined, 'source-ingress', 'target-ingress', false],
        ['EGRESS', undefined, 'source-egress', 'target-egress', false],
        ['INTERNET_INGRESS', undefined, 'source', 'target-ingress', true],
        ['INTERNET_EGRESS', undefined, 'source-egress', 'target', true],
    ] as const)('%s resolves renderer-neutral traffic facts', (direction, complete, sourceHandle, targetHandle, dashed) => {
        expect(graphEdgePresentation(edge(direction, complete))).toMatchObject({ sourceHandle, targetHandle, dashed, label: '443/TCP' });
    });

    test('renders cross-project connections amber and dashed', () => {
        expect(graphEdgePresentation({ ...edge('CONNECTION', true), external: true })).toMatchObject({
            color: '#f59e0b',
            dashed: true,
        });
    });
});
