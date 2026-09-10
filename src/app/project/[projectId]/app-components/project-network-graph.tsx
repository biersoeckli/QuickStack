'use client';

import type { CSSProperties } from 'react';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    Background,
    BackgroundVariant,
    Controls,
    Handle,
    MarkerType,
    Position,
    ReactFlow,
    type Node,
    type NodeProps,
    type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Bot, Boxes, Cloud, MoveRight, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PodStatusIndicator from '@/components/custom/pod-status-indicator';
import { cn } from '@/frontend/utils/utils';
import type { AppExtendedModel } from '@/shared/model/app-extended.model';
import type { UserSession } from '@/shared/model/sim-session.model';
import { UserGroupUtils } from '@/shared/utils/role.utils';
import { InternalHostnameUtils } from '@/server/utils/internal-hostname.utils';
import { NodeDetailsSheet, type PanelConnection } from './project-network-graph/node-details-sheet';
import { NetworkGraphNode } from './project-network-graph/project-network-graph-projection';
import { useProjectNetworkGraph } from './project-network-graph/use-project-network-graph';
import { graphEdgePresentation, graphLegendItems, NETWORK_GRAPH_COLORS } from './project-network-graph/project-network-graph-visual-semantics';

const handleClassName = '!h-1.5 !w-1.5 !border-0 !bg-transparent !opacity-0';

const WorkloadNode = ({
    data,
}: NodeProps<Node<NetworkGraphNode, 'workload'>>) => {
    const Icon = data.kind === 'AGENT' ? Bot : Boxes;
    return (
        <div className={cn('flex w-[190px] cursor-pointer items-center gap-2.5 rounded-xl border bg-card px-3 py-3 shadow-sm transition-colors hover:border-qs-500/50 hover:shadow-md', data.external && 'border-dashed border-amber-500/70 bg-amber-500/5')}>
            <div className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg ring-1', data.kind === 'AGENT' ? 'bg-violet-500/15 text-violet-600 ring-violet-500/30' : 'bg-qs-500/10 text-qs-600 ring-qs-500/30')}>
                <Icon className="size-4" />
            </div>
            <div className="min-w-0">
                <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium" title={data.name}>{data.name}</p>
                    {data.kind === 'APP' && <PodStatusIndicator appId={data.id.replace('APP:', '')} />}
                </div>
                {data.caption && <p className="truncate text-[11px] text-muted-foreground">{data.caption}</p>}
            </div>
            <Handle id="target-ingress" type="target" position={Position.Top} className={handleClassName} />
            <Handle id="source-ingress" type="source" position={Position.Bottom} className={handleClassName} />
            <Handle id="target-egress" type="target" position={Position.Left} className={handleClassName} />
            <Handle id="source-egress" type="source" position={Position.Right} className={handleClassName} />
        </div>
    );
};
const InternetNode = () => (
    <div className="flex flex-col items-center gap-1.5">
        <div className="flex size-16 items-center justify-center rounded-full border-2 border-dashed border-violet-400 bg-card text-violet-500 shadow-sm">
            <Cloud className="size-7" />
        </div>
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">Internet</span>
        <Handle id="target" type="target" position={Position.Bottom} className={handleClassName} style={{ left: '35%' }} />
        <Handle id="source" type="source" position={Position.Bottom} className={handleClassName} style={{ left: '65%' }} />
    </div>
);
const nodeTypes = { workload: WorkloadNode, internet: InternetNode } satisfies NodeTypes;

function Legend() {
    return (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground">
            {graphLegendItems.map(item => (
                <span key={item.kind} className="flex items-center gap-1.5">
                    <span
                        className={cn('inline-block w-6 border-t-2', item.kind === 'complete' && 'h-0.5 rounded-full border-0', item.kind !== 'complete' && 'h-0 border-dashed')}
                        style={{
                            borderColor: item.kind === 'internet' ? NETWORK_GRAPH_COLORS.internet : item.kind === 'external' ? NETWORK_GRAPH_COLORS.external : NETWORK_GRAPH_COLORS.connection,
                            background: item.kind === 'complete' ? NETWORK_GRAPH_COLORS.connection : undefined,
                        }}
                    />
                    {item.label}
                </span>
            ))}
            <span className="flex items-center gap-1.5"><Boxes className="size-3.5 text-qs-600" />App</span>
            <span className="flex items-center gap-1.5"><Bot className="size-3.5 text-violet-500" />Agent sandbox</span>
            <span className="flex items-center gap-1.5"><MoveRight className="size-3.5" />Arrows point in the direction of allowed traffic</span>
        </div>
    );
}

export default function ProjectNetworkGraph({
    apps,
    projectId,
    session,
}: {
    apps: AppExtendedModel[];
    projectId: string;
    session: UserSession;
}) {
    const router = useRouter();
    const [selectedNodeId, setSelectedNodeId] = useState<string>();
    const { layout, updateNodePosition, saveNodePosition, resetLayout } = useProjectNetworkGraph(apps, projectId);
    const nodes: Node[] = (layout?.nodes ?? []).map(node => ({
        id: node.id,
        type: node.kind === 'INTERNET' ? 'internet' : 'workload',
        position: node.position,
        data: node,
    }));
    const edges = (layout?.edges ?? []).map(edge => {
        const presentation = graphEdgePresentation(edge);
        return {
            id: edge.id,
            source: edge.source,
            target: edge.target,
            sourceHandle: presentation.sourceHandle,
            targetHandle: presentation.targetHandle,
            type: 'smoothstep' as const,
            pathOptions: { offset: 20 },
            markerEnd: { type: MarkerType.ArrowClosed, color: presentation.color, width: 16, height: 16 },
            style: { stroke: presentation.color, strokeWidth: 1.5, strokeDasharray: presentation.dashed ? '5 4' : undefined },
            label: presentation.label,
            labelStyle: { fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: 600 },
            labelBgStyle: { fill: 'hsl(var(--card))', fillOpacity: 0.9, stroke: 'hsl(var(--border))', strokeWidth: 1 },
            labelBgPadding: [6, 3] as [number, number],
            labelBgBorderRadius: 6,
        };
    });
    const selectedNode = nodes.find(node => node.id === selectedNodeId)?.data as NetworkGraphNode | undefined;
    const selectedApp = selectedNode?.kind === 'APP' ? apps.find(app => app.id === selectedNode.id.replace('APP:', '')) : undefined;
    const selectedAppRole = selectedApp ? UserGroupUtils.getRolePermissionForApp(session, selectedApp.id) ?? undefined : undefined;
    const selectedConnections = useMemo(() => (layout?.edges ?? [])
        .filter(edge => edge.source === selectedNodeId || edge.target === selectedNodeId)
        .map(edge => {
            const otherNode = (layout?.nodes ?? []).find(node => node.id === (edge.source === selectedNodeId ? edge.target : edge.source));
            const direction = edge.source === selectedNodeId ? 'Egress' : 'Ingress';
            const port = Number.parseInt(edge.labels[0] ?? '', 10);
            const copyValue = direction === 'Ingress' && otherNode?.kind === 'APP' && otherNode.projectId
                ? InternalHostnameUtils.getInternalBaseUrlForApp({ id: otherNode.id.replace('APP:', ''), projectId: otherNode.projectId }, Number.isNaN(port) ? undefined : port)
                : undefined;
            return { id: edge.id, name: otherNode?.name ?? 'Unknown workload', direction, label: graphEdgePresentation(edge).label, copyValue } satisfies PanelConnection;
        }), [layout, selectedNodeId]);

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <Legend />
                <Button variant="outline" size="sm" onClick={resetLayout}>
                    <RotateCcw className="mr-2 size-4" />
                    Reset layout
                </Button>
            </div>
            <div className="relative h-[calc(100vh-13rem)] min-h-[560px] overflow-hidden rounded-xl bg-background">
                    <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    nodeTypes={nodeTypes}
                    fitView
                    fitViewOptions={{ padding: 0.2, maxZoom: 1.1 }}
                    minZoom={0.3}
                    maxZoom={1.5}
                    zoomOnScroll={false}
                    zoomOnPinch={false}
                    zoomOnDoubleClick={false}
                    preventScrolling={false}
                    nodesDraggable
                    nodesConnectable={false}
                    elementsSelectable={false}
                    onNodeDrag={(_event, node) => updateNodePosition(node.id, node.position)}
                    onNodeDragStop={(_event, node) => saveNodePosition(node.id, node.position)}
                    style={{
                        '--xy-controls-button-background-color': 'hsl(var(--secondary))',
                        '--xy-controls-button-background-color-hover': 'hsl(var(--accent))',
                        '--xy-controls-button-color': 'hsl(var(--secondary-foreground))',
                        '--xy-controls-button-border-color': 'hsl(var(--border))',
                        '--xy-controls-box-shadow': '0 1px 3px 0 rgb(0 0 0 / 0.1)',
                    } as CSSProperties}
                    onNodeClick={(_event, node) => {
                        const data = node.data as NetworkGraphNode;
                        if (data.kind !== 'INTERNET') setSelectedNodeId(node.id);
                    }}
                >
                    <Background variant={BackgroundVariant.Dots} gap={22} size={1.5} color="hsl(var(--border))" />
                    <Controls showInteractive={false} />
                </ReactFlow>
                {edges.length === 0 && <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground"><Cloud className="size-6 opacity-40" /><p>No active network policy connections yet.</p></div>}
                {selectedNode && <NodeDetailsSheet node={selectedNode} app={selectedApp} role={selectedAppRole} connections={selectedConnections} open onOpenChange={open => { if (!open) setSelectedNodeId(undefined); }} onOpen={() => router.push(`/project/app/${selectedNode.id.replace('APP:', '')}`)} />}
            </div>
        </div>
    );
}
