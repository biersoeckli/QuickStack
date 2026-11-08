import { getFocusedNodeViewport } from './project-network-graph-focus';

describe('getFocusedNodeViewport', () => {
    test('keeps the selected node at the maximum focused zoom regardless of distant neighbours', () => {
        const selectedNode = { x: 3_000, y: 2_000, width: 240, height: 68 };

        expect(getFocusedNodeViewport({
            node: selectedNode,
            graphWidth: 1_600,
            graphHeight: 900,
            drawerWidth: 576,
        })).toEqual({
            x: -2_920.0000000000005,
            y: -1_787.4,
            zoom: 1.1,
        });
    });
});
