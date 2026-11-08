export type GraphViewport = {
    x: number;
    y: number;
    zoom: number;
};

export type FocusedNode = {
    x: number;
    y: number;
    width: number;
    height: number;
};

export function getFocusedNodeViewport({
    node,
    graphWidth,
    graphHeight,
    drawerWidth,
}: {
    node: FocusedNode;
    graphWidth: number;
    graphHeight: number;
    drawerWidth: number;
}): GraphViewport {
    const visibleGraphWidth = Math.max(0, graphWidth - drawerWidth);
    const padding = 72;
    const zoom = Math.max(0.3, Math.min(
        1.1,
        (visibleGraphWidth - padding * 2) / Math.max(node.width, 1),
        (graphHeight - padding * 2) / Math.max(node.height, 1),
    ));

    return {
        x: visibleGraphWidth / 2 - (node.x + node.width / 2) * zoom,
        y: graphHeight / 2 - (node.y + node.height / 2) * zoom,
        zoom,
    };
}
