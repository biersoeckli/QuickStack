import { applySavedNetworkGraphPositions, type PositionedProjectNetworkGraph } from './use-project-network-graph';

describe('applySavedNetworkGraphPositions', () => {
    it('overrides known nodes and retains generated positions for new nodes', () => {
        const layout = {
            nodes: [
                { id: 'APP:app-a', kind: 'APP', name: 'App A', external: false, position: { x: 1, y: 2 } },
                { id: 'APP:app-b', kind: 'APP', name: 'App B', external: false, position: { x: 3, y: 4 } },
            ],
            edges: [],
        } satisfies PositionedProjectNetworkGraph;

        const result = applySavedNetworkGraphPositions(layout, {
            'APP:app-a': { x: 10, y: 20 },
            'APP:removed': { x: 30, y: 40 },
        });

        expect(result.nodes.map(node => ({ id: node.id, position: node.position }))).toEqual([
            { id: 'APP:app-a', position: { x: 10, y: 20 } },
            { id: 'APP:app-b', position: { x: 3, y: 4 } },
        ]);
    });
});
