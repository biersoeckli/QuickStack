import type { NetworkGraphEdge, NetworkGraphEdgeDirection } from './project-network-graph-projection';

export const NETWORK_GRAPH_COLORS = { connection: '#0ea5e9', external: '#f59e0b', internet: '#8b5cf6' } as const;

export type NetworkGraphEdgePresentation = {
    sourceHandle: string;
    targetHandle: string;
    color: string;
    dashed: boolean;
    label?: string;
};

const handles: Record<NetworkGraphEdgeDirection, Pick<NetworkGraphEdgePresentation, 'sourceHandle' | 'targetHandle'>> = {
    CONNECTION: { sourceHandle: 'source-egress', targetHandle: 'target-ingress' },
    INTERNET_CONNECTION: { sourceHandle: 'source-internet', targetHandle: 'target' },
    INTERNET_EGRESS: { sourceHandle: 'source-egress', targetHandle: 'target' },
    INTERNET_INGRESS: { sourceHandle: 'source', targetHandle: 'target-ingress' },
    INGRESS: { sourceHandle: 'source-ingress', targetHandle: 'target-ingress' },
    EGRESS: { sourceHandle: 'source-egress', targetHandle: 'target-egress' },
};

export function graphEdgePresentation(edge: NetworkGraphEdge): NetworkGraphEdgePresentation {
    const internet = edge.direction.startsWith('INTERNET');
    return {
        ...handles[edge.direction],
        color: internet ? NETWORK_GRAPH_COLORS.internet : edge.external ? NETWORK_GRAPH_COLORS.external : NETWORK_GRAPH_COLORS.connection,
        dashed: internet ? !(edge.internetIngress && edge.internetEgress) : edge.external || edge.complete === false,
        label: edge.labels.join(' · ') || undefined,
    };
}

export const graphLegendItems = [
    { kind: 'complete', label: 'Complete' },
    { kind: 'incomplete', label: 'Incomplete' },
    { kind: 'external', label: 'Other project' },
    { kind: 'internet', label: 'Internet' },
] as const;
