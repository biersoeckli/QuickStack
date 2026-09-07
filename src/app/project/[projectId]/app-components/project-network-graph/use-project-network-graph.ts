'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ELK from 'elkjs/lib/elk.bundled.js';
import type { AppExtendedModel } from '@/shared/model/app-extended.model';
import { buildProjectNetworkGraph, type NetworkGraphNode, type ProjectNetworkGraphData } from './project-network-graph-projection';

export type NetworkGraphPosition = { x: number; y: number };
export type PositionedNetworkGraphNode = NetworkGraphNode & { position: NetworkGraphPosition };
export type PositionedProjectNetworkGraph = Omit<ProjectNetworkGraphData, 'nodes'> & { nodes: PositionedNetworkGraphNode[] };
type SavedPositions = Record<string, NetworkGraphPosition>;

const elk = new ELK();

function storageKey(projectId: string) { return `quickstack:project-network-graph:${projectId}`; }

function readSavedPositions(projectId: string): SavedPositions {
    try { return JSON.parse(window.localStorage.getItem(storageKey(projectId)) ?? '{}'); }
    catch { return {}; }
}

async function layoutGraph(graph: ProjectNetworkGraphData): Promise<PositionedProjectNetworkGraph> {
    const layout = await elk.layout({
        id: 'root',
        layoutOptions: {
            'elk.algorithm': 'layered', 'elk.direction': 'RIGHT',
            'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
            'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
            'elk.spacing.nodeNode': '70', 'elk.layered.spacing.nodeNodeBetweenLayers': '150',
        },
        children: graph.nodes.map(node => ({ id: node.id, width: node.kind === 'INTERNET' ? 96 : 190, height: node.kind === 'INTERNET' ? 96 : 64 })),
        edges: graph.edges.map(edge => ({ id: edge.id, sources: [edge.source], targets: [edge.target] })),
    });
    const positions = new Map(layout.children?.map(node => [node.id, node]) ?? []);
    return { ...graph, nodes: graph.nodes.map(node => ({ ...node, position: { x: positions.get(node.id)?.x ?? 0, y: positions.get(node.id)?.y ?? 0 } })) };
}

export function useProjectNetworkGraph(apps: AppExtendedModel[], projectId: string) {
    const graph = useMemo(() => buildProjectNetworkGraph(apps), [apps]);
    const [layout, setLayout] = useState<PositionedProjectNetworkGraph>();
    const requestId = useRef(0);
    const loadLayout = useCallback(async (useSavedPositions: boolean) => {
        const id = ++requestId.current;
        const nextLayout = await layoutGraph(graph);
        if (id !== requestId.current) return;
        const savedPositions = useSavedPositions ? readSavedPositions(projectId) : {};
        setLayout({ ...nextLayout, nodes: nextLayout.nodes.map(node => ({ ...node, position: savedPositions[node.id] ?? node.position })) });
    }, [graph, projectId]);

    useEffect(() => { void loadLayout(true); }, [loadLayout]);

    const updateNodePosition = useCallback((id: string, position: NetworkGraphPosition) => {
        setLayout(current => current && ({ ...current, nodes: current.nodes.map(node => node.id === id ? { ...node, position } : node) }));
    }, []);
    const saveNodePosition = useCallback((id: string, position: NetworkGraphPosition) => {
        updateNodePosition(id, position);
        window.localStorage.setItem(storageKey(projectId), JSON.stringify({ ...readSavedPositions(projectId), [id]: position }));
    }, [projectId, updateNodePosition]);
    const resetLayout = useCallback(() => {
        window.localStorage.removeItem(storageKey(projectId));
        void loadLayout(false);
    }, [loadLayout, projectId]);

    return { layout, updateNodePosition, saveNodePosition, resetLayout };
}
