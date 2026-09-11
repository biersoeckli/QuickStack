'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ELK from 'elkjs/lib/elk.bundled.js';
import type { AppExtendedModel } from '@/shared/model/app-extended.model';
import { buildProjectNetworkGraph, type NetworkGraphNode, type ProjectNetworkGraphData } from './project-network-graph-projection';
import type { NetworkGraphPosition, ProjectNetworkGraphPositions } from '@/shared/model/project-network-graph-layout.model';
import { resetProjectNetworkGraphLayout, saveProjectNetworkGraphPosition } from '../../actions';
import { toast } from 'sonner';

export type PositionedNetworkGraphNode = NetworkGraphNode & { position: NetworkGraphPosition };
export type PositionedProjectNetworkGraph = Omit<ProjectNetworkGraphData, 'nodes'> & { nodes: PositionedNetworkGraphNode[] };

const elk = new ELK();

async function layoutGraph(graph: ProjectNetworkGraphData): Promise<PositionedProjectNetworkGraph> {
    const layout = await elk.layout({
        id: 'root',
        layoutOptions: {
            'elk.algorithm': 'layered', 'elk.direction': 'RIGHT',
            'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
            'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
            'elk.spacing.nodeNode': '70', 'elk.layered.spacing.nodeNodeBetweenLayers': '150',
        },
        children: graph.nodes.map(node => ({ id: node.id, width: node.kind === 'INTERNET' ? 96 : 240, height: node.kind === 'INTERNET' ? 96 : 68 })),
        edges: graph.edges.map(edge => ({ id: edge.id, sources: [edge.source], targets: [edge.target] })),
    });
    const positions = new Map(layout.children?.map(node => [node.id, node]) ?? []);
    return { ...graph, nodes: graph.nodes.map(node => ({ ...node, position: { x: positions.get(node.id)?.x ?? 0, y: positions.get(node.id)?.y ?? 0 } })) };
}

export function applySavedNetworkGraphPositions(
    layout: PositionedProjectNetworkGraph,
    savedPositions: ProjectNetworkGraphPositions,
): PositionedProjectNetworkGraph {
    return {
        ...layout,
        nodes: layout.nodes.map(node => ({
            ...node,
            position: savedPositions[node.id] ?? node.position,
        })),
    };
}

export function useProjectNetworkGraph(
    apps: AppExtendedModel[],
    projectId: string,
    savedPositions: ProjectNetworkGraphPositions,
) {
    const graph = useMemo(() => buildProjectNetworkGraph(apps), [apps]);
    const [layout, setLayout] = useState<PositionedProjectNetworkGraph>();
    const requestId = useRef(0);
    const persistedPositions = useRef(savedPositions);
    const loadLayout = useCallback(async (useSavedPositions: boolean) => {
        const id = ++requestId.current;
        const nextLayout = await layoutGraph(graph);
        if (id !== requestId.current) return;
        const positions = useSavedPositions ? persistedPositions.current : {};
        setLayout(applySavedNetworkGraphPositions(nextLayout, positions));
    }, [graph]);

    useEffect(() => {
        persistedPositions.current = savedPositions;
        void loadLayout(true);
    }, [loadLayout, savedPositions]);

    const updateNodePosition = useCallback((id: string, position: NetworkGraphPosition) => {
        setLayout(current => current && ({ ...current, nodes: current.nodes.map(node => node.id === id ? { ...node, position } : node) }));
    }, []);
    const saveNodePosition = useCallback(async (id: string, position: NetworkGraphPosition) => {
        const previousPosition = layout?.nodes.find(node => node.id === id)?.position;
        updateNodePosition(id, position);
        const result = await saveProjectNetworkGraphPosition(projectId, { nodeId: id, ...position });
        if (result.status === 'success') {
            persistedPositions.current = { ...persistedPositions.current, [id]: position };
            return;
        }
        if (previousPosition) updateNodePosition(id, previousPosition);
        toast.error(result.message ?? 'Could not save the network graph layout.');
    }, [layout?.nodes, projectId, updateNodePosition]);
    const resetLayout = useCallback(async () => {
        const result = await resetProjectNetworkGraphLayout(projectId);
        if (result.status !== 'success') {
            toast.error(result.message ?? 'Could not reset the network graph layout.');
            return;
        }
        persistedPositions.current = {};
        await loadLayout(false);
    }, [loadLayout, projectId]);

    return { layout, saveNodePosition, resetLayout };
}
