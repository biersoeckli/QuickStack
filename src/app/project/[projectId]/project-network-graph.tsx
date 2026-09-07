'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import ELK from 'elkjs/lib/elk.bundled.js';
import { useRouter } from 'next/navigation';
import {
    Background, BackgroundVariant, Controls, Handle, MarkerType, Position, ReactFlow,
    type Node, type NodeProps, type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Bot, Boxes, Cloud, MoveRight, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PodStatusIndicator from '@/components/custom/pod-status-indicator';
import { cn } from '@/frontend/utils/utils';
import { AppExtendedModel } from '@/shared/model/app-extended.model';

type WorkloadType = 'APP' | 'AGENT';
type NodeKind = WorkloadType | 'INTERNET';
type GraphNode = {
    id: string; kind: NodeKind; name: string; projectId?: string; external: boolean; caption?: string;
};
type GraphEdge = {
    id: string; source: string; target: string;
    direction: 'CONNECTION' | 'INGRESS' | 'EGRESS' | 'INTERNET_INGRESS' | 'INTERNET_EGRESS';
    labels: string[]; external: boolean; complete?: boolean;
};
export type ProjectNetworkGraphData = { nodes: GraphNode[]; edges: GraphEdge[] };

const EDGE_COLORS = { ingress: '#10b981', egress: '#0ea5e9', internet: '#8b5cf6' } as const;
const handleClassName = '!h-1.5 !w-1.5 !border-0 !bg-transparent !opacity-0';
const elk = new ELK();

type SavedPositions = Record<string, { x: number; y: number }>;

function storageKey(projectId: string) {
    return `quickstack:project-network-graph:${projectId}`;
}

function readSavedPositions(projectId: string): SavedPositions {
    try {
        return JSON.parse(window.localStorage.getItem(storageKey(projectId)) ?? '{}');
    } catch {
        return {};
    }
}

function workloadNodeId(type: WorkloadType, id: string) {
    return `${type}:${id}`;
}
function formatRuleLabel(port: number, protocol: string) {
    return `${port}/${protocol.toUpperCase()}`;
}
function aggregateLabels(labels: string[]) {
    return Array.from(new Set(labels)).sort((a, b) => {
        const portA = parseInt(a, 10);
        const portB = parseInt(b, 10);
        return !Number.isNaN(portA) && !Number.isNaN(portB) ? portA - portB : a.localeCompare(b);
    });
}

function consolidateConnections(edges: GraphEdge[]) {
    const networkEdges = edges.filter(edge => edge.direction.startsWith('INTERNET'));
    const groups = new Map<string, { ingress: GraphEdge[]; egress: GraphEdge[] }>();
    for (const edge of edges.filter(edge => !edge.direction.startsWith('INTERNET'))) {
        const key = `${edge.source}:${edge.target}`;
        const group = groups.get(key) ?? { ingress: [], egress: [] };
        if (edge.direction === 'INGRESS') group.ingress.push(edge);
        else group.egress.push(edge);
        groups.set(key, group);
    }
    const connections = Array.from(groups.entries()).map(([key, group]) => {
        const ingressLabels = aggregateLabels(group.ingress.flatMap(edge => edge.labels));
        const egressLabels = aggregateLabels(group.egress.flatMap(edge => edge.labels));
        const labels = aggregateLabels([...ingressLabels, ...egressLabels]);
        const complete = ingressLabels.length > 0
            && ingressLabels.length === egressLabels.length
            && ingressLabels.every((label, index) => label === egressLabels[index]);
        const reference = group.egress[0] ?? group.ingress[0];
        return { id: `CONNECTION:${key}`, source: reference.source, target: reference.target, direction: 'CONNECTION' as const, labels, external: reference.external, complete };
    });
    return [...networkEdges, ...connections];
}

/** Converts active Extended App Network Policy Configurations into project-wide graph data. */
export function buildProjectNetworkGraph(apps: AppExtendedModel[]): ProjectNetworkGraphData {
    const projectId = apps[0]?.projectId;
    const internalAppIds = new Set(apps.map(app => app.id));
    const nodes = new Map<string, GraphNode>();
    const edges = new Map<string, GraphEdge>();
    const addNode = (node: GraphNode) => {
        if (!nodes.has(node.id)) nodes.set(node.id, node);
    };
    const addEdge = (source: string, target: string, direction: GraphEdge['direction'], label: string, external: boolean) => {
        const key = `${direction}:${source}:${target}`;
        const edge = edges.get(key);
        if (edge) {
            edge.labels.push(label);
        } else {
            edges.set(key, { id: key, source, target, direction, labels: [label], external });
        }
    };

    for (const app of apps) {
        const appNodeId = workloadNodeId('APP', app.id);
        addNode({ id: appNodeId, kind: 'APP', name: app.name, projectId: app.projectId, external: false });
        if (!app.useNetworkPolicy) continue;

        for (const rule of app.appNetworkPolicy?.rules ?? []) {
            const target = rule.targetApp ?? rule.targetAgent;
            if (!target) continue;
            const targetType: WorkloadType = rule.targetApp ? 'APP' : 'AGENT';
            const targetNodeId = workloadNodeId(targetType, target.id);
            const external = targetType !== 'APP' || !internalAppIds.has(target.id);
            addNode({
                id: targetNodeId, kind: targetType, name: target.name, projectId: target.projectId, external,
                caption: external && target.projectId !== projectId ? 'Other project' : targetType === 'AGENT' ? 'Agent sandbox' : undefined,
            });
            const label = formatRuleLabel(rule.port, rule.protocol);
            if (rule.type === 'INGRESS') addEdge(targetNodeId, appNodeId, 'INGRESS', label, external);
            else addEdge(appNodeId, targetNodeId, 'EGRESS', label, external);
        }

        if (app.appNetworkPolicy?.allowInternetAccess !== false) {
            addNode({ id: 'INTERNET', kind: 'INTERNET', name: 'Internet', external: false });
            addEdge(appNodeId, 'INTERNET', 'INTERNET_EGRESS', '', false);
        }
        if (app.appDomains.length > 0) {
            addNode({ id: 'INTERNET', kind: 'INTERNET', name: 'Internet', external: false });
            for (const domain of app.appDomains) {
                addEdge('INTERNET', appNodeId, 'INTERNET_INGRESS', `${domain.hostname}:${domain.port}`, false);
            }
        }
    }
    const rawEdges = Array.from(edges.values()).map(edge => ({ ...edge, labels: aggregateLabels(edge.labels) }));
    return {
        nodes: Array.from(nodes.values()),
        edges: consolidateConnections(rawEdges),
    };
}

const WorkloadNode = ({ data }: NodeProps<Node<GraphNode, 'workload'>>) => {
    const Icon = data.kind === 'AGENT' ? Bot : Boxes;
    const iconClasses = data.kind === 'AGENT'
        ? 'bg-violet-500/15 text-violet-600 ring-violet-500/30'
        : 'bg-qs-500/10 text-qs-600 ring-qs-500/30';
    return <div className={cn(
        'flex w-[190px] cursor-pointer items-center gap-2.5 rounded-xl border bg-card px-3 py-3 shadow-sm transition-colors hover:border-qs-500/50 hover:shadow-md',
        data.external && 'border-dashed border-amber-500/70 bg-amber-500/5',
    )}>
        <div className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg ring-1', iconClasses)}>
            <Icon className="size-4" />
        </div>
        <div className="min-w-0">
            <p className="truncate text-sm font-medium" title={data.name}>{data.name}</p>
            {data.caption && <p className="truncate text-[11px] text-muted-foreground">{data.caption}</p>}
        </div>
        {data.kind === 'APP' && <div className="ml-auto shrink-0"><PodStatusIndicator appId={data.id.replace('APP:', '')} /></div>}
        <Handle id="target-ingress" type="target" position={Position.Top} className={handleClassName} />
        <Handle id="source-ingress" type="source" position={Position.Bottom} className={handleClassName} />
        <Handle id="target-egress" type="target" position={Position.Left} className={handleClassName} />
        <Handle id="source-egress" type="source" position={Position.Right} className={handleClassName} />
    </div>;
};
const InternetNode = () => <div className="flex flex-col items-center gap-1.5">
    <div className="flex size-16 items-center justify-center rounded-full border-2 border-dashed border-violet-400 bg-card text-violet-500 shadow-sm"><Cloud className="size-7" /></div>
    <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">Internet</span>
    <Handle id="target" type="target" position={Position.Bottom} className={handleClassName} style={{ left: '35%' }} />
    <Handle id="source" type="source" position={Position.Bottom} className={handleClassName} style={{ left: '65%' }} />
</div>;
const nodeTypes = { workload: WorkloadNode, internet: InternetNode } satisfies NodeTypes;

function edgeStyle(edge: GraphEdge) {
    const internet = edge.direction.startsWith('INTERNET');
    const color = internet ? EDGE_COLORS.internet : '#0ea5e9';
    return {
        type: 'smoothstep' as const,
        pathOptions: { offset: 20 },
        markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 },
        style: { stroke: color, strokeWidth: 1.5, strokeDasharray: internet || edge.complete === false ? '5 4' : undefined },
        label: edge.labels.join(' · ') || undefined,
        labelStyle: { fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: 600 },
        labelBgStyle: { fill: 'hsl(var(--card))', fillOpacity: 0.9, stroke: 'hsl(var(--border))', strokeWidth: 1 },
        labelBgPadding: [6, 3] as [number, number],
        labelBgBorderRadius: 6,
    };
}

export function graphEdgeHandles(edge: GraphEdge) {
    switch (edge.direction) {
        case 'CONNECTION':
            return { sourceHandle: 'source-egress', targetHandle: 'target-ingress' };
        case 'INTERNET_EGRESS':
            return { sourceHandle: 'source-egress', targetHandle: 'target' };
        case 'INTERNET_INGRESS':
            return { sourceHandle: 'source', targetHandle: 'target-ingress' };
        case 'INGRESS':
            return { sourceHandle: 'source-ingress', targetHandle: 'target-ingress' };
        case 'EGRESS':
            return { sourceHandle: 'source-egress', targetHandle: 'target-egress' };
    }
}

async function graphLayout(graph: ProjectNetworkGraphData) {
    const layoutGraph = await elk.layout({
        id: 'root',
        layoutOptions: {
            'elk.algorithm': 'layered',
            'elk.direction': 'RIGHT',
            'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
            'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
            'elk.spacing.nodeNode': '70',
            'elk.layered.spacing.nodeNodeBetweenLayers': '150',
        },
        children: graph.nodes.map(node => ({
            id: node.id,
            width: node.kind === 'INTERNET' ? 96 : 190,
            height: node.kind === 'INTERNET' ? 96 : 64,
        })),
        edges: graph.edges.map(edge => ({ id: edge.id, sources: [edge.source], targets: [edge.target] })),
    });
    const positions = new Map(layoutGraph.children?.map(node => [node.id, node]) ?? []);
    const nodes: Node[] = graph.nodes.map(node => {
        const position = positions.get(node.id);
        return {
            id: node.id,
            type: node.kind === 'INTERNET' ? 'internet' : 'workload',
            position: { x: position?.x ?? 0, y: position?.y ?? 0 },
            data: node,
        };
    });
    const edges = graph.edges.map(edge => {
        return {
            id: edge.id,
            source: edge.source,
            target: edge.target,
            ...graphEdgeHandles(edge),
            ...edgeStyle(edge),
        };
    });
    return { nodes, edges };
}

function Legend() {
    return <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-6 rounded-full text-sky-500" style={{ background: '#0ea5e9' }} />Complete connection</span><span className="flex items-center gap-1.5"><span className="inline-block h-0 w-6 border-t-2 border-dashed border-sky-500" />Incomplete connection</span><span className="flex items-center gap-1.5"><span className="inline-block h-0 w-6 border-t-2 border-dashed" style={{ borderColor: EDGE_COLORS.internet }} />Internet access</span><span className="flex items-center gap-1.5"><Boxes className="size-3.5 text-qs-600" />App</span><span className="flex items-center gap-1.5"><Bot className="size-3.5 text-violet-500" />Agent sandbox</span><span className="flex items-center gap-1.5"><MoveRight className="size-3.5" />Arrows point in the direction of allowed traffic</span>
    </div>;
}

export default function ProjectNetworkGraph({ apps, projectId }: { apps: AppExtendedModel[]; projectId: string }) {
    const router = useRouter();
    const graph = useMemo(() => buildProjectNetworkGraph(apps), [apps]);
    const [layout, setLayout] = useState<Awaited<ReturnType<typeof graphLayout>>>();

    useEffect(() => {
        let cancelled = false;
        graphLayout(graph).then(nextLayout => {
            if (cancelled) return;
            const savedPositions = readSavedPositions(projectId);
            setLayout({
                ...nextLayout,
                nodes: nextLayout.nodes.map(node => ({
                    ...node,
                    position: savedPositions[node.id] ?? node.position,
                })),
            });
        });
        return () => { cancelled = true; };
    }, [graph, projectId]);

    const nodes = layout?.nodes ?? [];
    const edges = layout?.edges ?? [];
    if (edges.length === 0) return <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-center text-sm text-muted-foreground"><Cloud className="size-6 opacity-40" /><p>No active network policy connections yet.</p></div>;
    const updateNodePosition = (node: Node) => {
        setLayout(current => current && ({ ...current, nodes: current.nodes.map(item => item.id === node.id ? { ...item, position: node.position } : item) }));
    };
    const savePosition = (_event: React.MouseEvent, node: Node) => {
        updateNodePosition(node);
        const savedPositions = readSavedPositions(projectId);
        window.localStorage.setItem(storageKey(projectId), JSON.stringify({ ...savedPositions, [node.id]: node.position }));
    };
    const resetLayout = () => {
        window.localStorage.removeItem(storageKey(projectId));
        graphLayout(graph).then(setLayout);
    };
    return <div className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><Legend /><Button variant="outline" size="sm" onClick={resetLayout}><RotateCcw className="mr-2 size-4" />Reset layout</Button></div><div className="h-[560px] rounded-xl border bg-muted/20"><ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.2, maxZoom: 1.1 }} minZoom={0.3} maxZoom={1.5} zoomOnScroll={false} zoomOnPinch={false} zoomOnDoubleClick={false} preventScrolling={false} nodesDraggable nodesConnectable={false} elementsSelectable={false} onNodeDrag={(_event, node) => updateNodePosition(node)} onNodeDragStop={savePosition} style={{ '--xy-controls-button-background-color': 'hsl(var(--secondary))', '--xy-controls-button-background-color-hover': 'hsl(var(--accent))', '--xy-controls-button-color': 'hsl(var(--secondary-foreground))', '--xy-controls-button-border-color': 'hsl(var(--border))', '--xy-controls-box-shadow': '0 1px 3px 0 rgb(0 0 0 / 0.1)' } as CSSProperties} onNodeClick={(_event, node) => { const data = node.data as GraphNode; if (data.kind === 'APP') router.push(`/project/app/${data.id.replace('APP:', '')}`); if (data.kind === 'AGENT') router.push(`/project/agent/${data.id.replace('AGENT:', '')}`); }}><Background variant={BackgroundVariant.Dots} gap={22} size={1.5} color="hsl(var(--border))" /><Controls showInteractive={false} /></ReactFlow></div></div>;
}
