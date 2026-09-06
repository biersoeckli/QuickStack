'use client';

import { useMemo, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import {
    Background,
    BackgroundVariant,
    Controls,
    Handle,
    MarkerType,
    Position,
    ReactFlow,
    type Edge,
    type Node,
    type NodeProps,
    type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Bot, Boxes, Cloud, MoveRight } from 'lucide-react';
import { cn } from '@/frontend/utils/utils';
import { AppNetworkPolicyRuleWithTargetAppModel } from '@/shared/model/app-extended.model';

type WorkloadType = 'APP' | 'AGENT';

type ProjectBrief = { id: string; name: string };

type Neighbor = {
    type: WorkloadType;
    id: string;
    name: string;
    projectId: string;
    ingress: string[];
    egress: string[];
};

const CENTER_WIDTH = 224;
const PEER_WIDTH = 200;
const ROW_SPACING = 170;
const COLUMN_X_LEFT = -360;
const COLUMN_X_RIGHT = 360;
const INTERNET_Y = -320;

const EDGE_COLORS = {
    ingress: '#10b981',
    egress: '#0ea5e9',
    internet: '#8b5cf6',
} as const;

const handleClassName = '!h-1.5 !w-1.5 !border-0 !bg-transparent !opacity-0';

function formatRuleLabel(port: number, protocol: string) {
    return `${port}/${protocol.toUpperCase()}`;
}

function aggregateLabels(labels: string[]) {
    return Array.from(new Set(labels)).sort((a, b) => {
        const portA = parseInt(a, 10);
        const portB = parseInt(b, 10);
        if (!Number.isNaN(portA) && !Number.isNaN(portB)) return portA - portB;
        return a.localeCompare(b);
    }).join(' · ');
}

function collectNeighbors(rules: AppNetworkPolicyRuleWithTargetAppModel[], appId: string) {
    const map = new Map<string, Neighbor>();
    for (const rule of rules) {
        const target = rule.targetAgent ?? rule.targetApp;
        if (!target) continue;
        if (rule.targetAppId === appId || rule.targetAgentId === appId) continue;
        const type: WorkloadType = rule.targetApp ? 'APP' : 'AGENT';
        const key = `${type}:${target.id}`;
        let neighbor = map.get(key);
        if (!neighbor) {
            neighbor = { type, id: target.id, name: target.name, projectId: target.projectId, ingress: [], egress: [] };
            map.set(key, neighbor);
        }
        const label = formatRuleLabel(rule.port, rule.protocol);
        if (rule.type === 'INGRESS') neighbor.ingress.push(label);
        else if (rule.type === 'EGRESS') neighbor.egress.push(label);
    }
    return Array.from(map.values()).map(neighbor => ({
        ...neighbor,
        ingress: aggregateLabels(neighbor.ingress).split(' · ').filter(Boolean),
        egress: aggregateLabels(neighbor.egress).split(' · ').filter(Boolean),
    }));
}

type PeerNodeData = {
    type: WorkloadType;
    name: string;
    side: 'left' | 'right';
    both: boolean;
    caption?: string;
};

type CenterNodeData = {
    name: string;
};

type InternetNodeData = Record<string, never>;

const CenterNode = ({ data }: NodeProps<Node<CenterNodeData, 'center'>>) => (
    <div className="relative flex min-w-[224px] flex-col items-center gap-1.5 rounded-xl border-2 border-qs-500 bg-card px-5 py-4 shadow-lg">
        <span className="absolute -top-2.5 rounded-full bg-qs-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">This app</span>
        <div className="flex size-10 items-center justify-center rounded-lg bg-qs-500/15 text-qs-600 ring-1 ring-qs-500/30">
            <Boxes className="size-5" />
        </div>
        <p className="max-w-[180px] truncate text-sm font-semibold" title={data.name}>{data.name}</p>
        <Handle id="in-left" type="target" position={Position.Left} className={handleClassName} style={{ top: '50%' }} />
        <Handle id="out-right" type="source" position={Position.Right} className={handleClassName} style={{ top: '22%' }} />
        <Handle id="in-right" type="target" position={Position.Right} className={handleClassName} style={{ top: '78%' }} />
        <Handle id="out-internet" type="source" position={Position.Top} className={handleClassName} />
    </div>
);

const PeerNode = ({ data }: NodeProps<Node<PeerNodeData, 'peer'>>) => {
    const AgentIcon = data.type === 'AGENT' ? Bot : Boxes;
    const iconClasses = data.type === 'AGENT'
        ? 'bg-violet-500/15 text-violet-600 ring-violet-500/30'
        : 'bg-qs-500/10 text-qs-600 ring-qs-500/30';
    return (
        <div className="group flex w-[200px] cursor-pointer items-center gap-2.5 rounded-xl border bg-card px-3 py-2.5 shadow-sm transition-colors hover:border-qs-500/50 hover:shadow-md">
            <div className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg ring-1', iconClasses)}>
                <AgentIcon className="size-4" />
            </div>
            <div className="min-w-0">
                <p className="truncate text-sm font-medium" title={data.name}>{data.name}</p>
                {data.caption && <p className="truncate text-[11px] text-muted-foreground">{data.caption}</p>}
            </div>
            {data.side === 'left' && <Handle id="source" type="source" position={Position.Right} className={handleClassName} style={{ top: '50%' }} />}
            {data.side === 'right' && (
                <>
                    <Handle id="egress-in" type="target" position={Position.Left} className={handleClassName} style={{ top: '22%' }} />
                    {data.both && <Handle id="ingress-out" type="source" position={Position.Left} className={handleClassName} style={{ top: '78%' }} />}
                </>
            )}
        </div>
    );
};

const InternetNode = () => (
    <div className="flex flex-col items-center gap-1.5">
        <div className="flex size-16 items-center justify-center rounded-full border-2 border-dashed border-violet-400 bg-card text-violet-500 shadow-sm">
            <Cloud className="size-7" />
        </div>
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">Internet</span>
        <Handle id="target" type="target" position={Position.Bottom} className={handleClassName} />
    </div>
);

const nodeTypes = { peer: PeerNode, center: CenterNode, internet: InternetNode } satisfies NodeTypes;

function getLegendItem(label: string, children: React.ReactNode) {
    return (
        <span className="flex items-center gap-1.5">
            {children}
            <span>{label}</span>
        </span>
    );
}

function Legend() {
    return (
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground">
            {getLegendItem('Ingress rule', <span className="inline-block h-0.5 w-6 rounded-full" style={{ background: EDGE_COLORS.ingress }} />)}
            {getLegendItem('Egress rule', <span className="inline-block h-0.5 w-6 rounded-full" style={{ background: EDGE_COLORS.egress }} />)}
            {getLegendItem('Internet access', <span className="inline-block h-0 w-6 border-t-2 border-dashed" style={{ borderColor: EDGE_COLORS.internet }} />)}
            {getLegendItem('App', <Boxes className="size-3.5 text-qs-600" />)}
            {getLegendItem('Agent sandbox', <Bot className="size-3.5 text-violet-500" />)}
            <span className="flex items-center gap-1.5"><MoveRight className="size-3.5" />Arrows point in the direction of allowed traffic</span>
        </div>
    );
}

function edgeLabelStyle() {
    return {
        labelStyle: { fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: 600 },
        labelBgStyle: { fill: 'hsl(var(--card))', fillOpacity: 0.9, stroke: 'hsl(var(--border))', strokeWidth: 1 },
        labelBgPadding: [6, 3] as [number, number],
        labelBgBorderRadius: 6,
    };
}

export default function NetworkPolicyGraph({
    appId,
    appName,
    appProjectId,
    rules,
    allowInternetAccess,
    projects,
}: {
    appId: string;
    appName: string;
    appProjectId: string;
    rules: AppNetworkPolicyRuleWithTargetAppModel[];
    allowInternetAccess: boolean;
    projects: ProjectBrief[];
}) {
    const router = useRouter();

    const projectNameById = useMemo(() => {
        const map = new Map<string, string>();
        for (const project of projects) map.set(project.id, project.name);
        return map;
    }, [projects]);

    const { nodes, edges, hasContent } = useMemo(() => {
        const neighbors = collectNeighbors(rules, appId);
        const ingressOnly = neighbors.filter(neighbor => neighbor.ingress.length > 0 && neighbor.egress.length === 0);
        const egressOnly = neighbors.filter(neighbor => neighbor.egress.length > 0 && neighbor.ingress.length === 0);
        const both = neighbors.filter(neighbor => neighbor.ingress.length > 0 && neighbor.egress.length > 0);
        const leftPeers = [...ingressOnly].sort((a, b) => a.name.localeCompare(b.name));
        const rightPeers = [...egressOnly, ...both].sort((a, b) => a.name.localeCompare(b.name));

        const hasContent = neighbors.length > 0 || allowInternetAccess;

        const nodes: (Node<CenterNodeData, 'center'> | Node<PeerNodeData, 'peer'> | Node<InternetNodeData, 'internet'>)[] = [];
        const edges: Edge[] = [];

        nodes.push({
            id: 'center',
            type: 'center',
            position: { x: -CENTER_WIDTH / 2, y: -60 },
            data: { name: appName },
        });

        const captionFor = (neighbor: Neighbor) => {
            const parts: string[] = [];
            if (neighbor.type === 'AGENT') parts.push('Agent sandbox');
            if (neighbor.projectId !== appProjectId) parts.push(projectNameById.get(neighbor.projectId) ?? 'Other project');
            return parts.join(' · ');
        };

        const yForIndex = (index: number, count: number) => (index - (count - 1) / 2) * ROW_SPACING;

        leftPeers.forEach((neighbor, index) => {
            const y = yForIndex(index, leftPeers.length);
            nodes.push({
                id: `${neighbor.type}:${neighbor.id}`,
                type: 'peer',
                position: { x: COLUMN_X_LEFT - PEER_WIDTH / 2, y: y - 28 },
                data: { type: neighbor.type, name: neighbor.name, side: 'left', both: false, caption: captionFor(neighbor) },
            });
            edges.push({
                ...edgeLabelStyle(),
                id: `edge-ingress-${neighbor.type}-${neighbor.id}`,
                source: `${neighbor.type}:${neighbor.id}`,
                target: 'center',
                sourceHandle: 'source',
                targetHandle: 'in-left',
                label: aggregateLabels(neighbor.ingress),
                markerEnd: { type: MarkerType.ArrowClosed, color: EDGE_COLORS.ingress, width: 16, height: 16 },
                style: { stroke: EDGE_COLORS.ingress, strokeWidth: 1.5 },
            });
        });

        rightPeers.forEach((neighbor, index) => {
            const y = yForIndex(index, rightPeers.length);
            const hasIngress = neighbor.ingress.length > 0;
            nodes.push({
                id: `${neighbor.type}:${neighbor.id}`,
                type: 'peer',
                position: { x: COLUMN_X_RIGHT - PEER_WIDTH / 2, y: y - 28 },
                data: { type: neighbor.type, name: neighbor.name, side: 'right', both: hasIngress, caption: captionFor(neighbor) },
            });
            edges.push({
                ...edgeLabelStyle(),
                id: `edge-egress-${neighbor.type}-${neighbor.id}`,
                source: 'center',
                target: `${neighbor.type}:${neighbor.id}`,
                sourceHandle: 'out-right',
                targetHandle: 'egress-in',
                label: aggregateLabels(neighbor.egress),
                markerEnd: { type: MarkerType.ArrowClosed, color: EDGE_COLORS.egress, width: 16, height: 16 },
                style: { stroke: EDGE_COLORS.egress, strokeWidth: 1.5 },
            });
            if (hasIngress) {
                edges.push({
                    ...edgeLabelStyle(),
                    id: `edge-ingress-reverse-${neighbor.type}-${neighbor.id}`,
                    source: `${neighbor.type}:${neighbor.id}`,
                    target: 'center',
                    sourceHandle: 'ingress-out',
                    targetHandle: 'in-right',
                    label: aggregateLabels(neighbor.ingress),
                    markerEnd: { type: MarkerType.ArrowClosed, color: EDGE_COLORS.ingress, width: 16, height: 16 },
                    style: { stroke: EDGE_COLORS.ingress, strokeWidth: 1.5 },
                });
            }
        });

        if (allowInternetAccess) {
            nodes.push({
                id: 'internet',
                type: 'internet',
                position: { x: -48, y: INTERNET_Y - 48 },
                data: {},
            });
            edges.push({
                id: 'edge-internet',
                source: 'center',
                target: 'internet',
                sourceHandle: 'out-internet',
                targetHandle: 'target',
                markerEnd: { type: MarkerType.ArrowClosed, color: EDGE_COLORS.internet, width: 16, height: 16 },
                style: { stroke: EDGE_COLORS.internet, strokeWidth: 1.5, strokeDasharray: '5 4' },
            });
        }

        return { nodes, edges, hasContent };
    }, [allowInternetAccess, appId, appName, appProjectId, projectNameById, rules]);

    if (!hasContent) {
        return (
            <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-center text-sm text-muted-foreground">
                <Cloud className="size-6 opacity-40" />
                <p>No connections yet. Network policy rules will be visualized here.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="h-[480px] rounded-xl border bg-muted/20">
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    nodeTypes={nodeTypes}
                    fitView
                    fitViewOptions={{ padding: 0.2, maxZoom: 1.1 }}
                    minZoom={0.3}
                    maxZoom={1.5}
                    nodesDraggable={false}
                    nodesConnectable={false}
                    elementsSelectable={false}
                    style={{
                        '--xy-controls-button-background-color': 'hsl(var(--secondary))',
                        '--xy-controls-button-background-color-hover': 'hsl(var(--accent))',
                        '--xy-controls-button-color': 'hsl(var(--secondary-foreground))',
                        '--xy-controls-button-border-color': 'hsl(var(--border))',
                        '--xy-controls-box-shadow': '0 1px 3px 0 rgb(0 0 0 / 0.1)',
                    } as CSSProperties}
                    onNodeClick={(_event, node) => {
                        if (node.type !== 'peer') return;
                        const [workloadType, workloadId] = String(node.id).split(':');
                        router.push(workloadType === 'AGENT' ? `/project/agent/${workloadId}` : `/project/app/${workloadId}`);
                    }}
                >
                    <Background variant={BackgroundVariant.Dots} gap={22} size={1.5} color="hsl(var(--border))" />
                    <Controls showInteractive={false} />
                </ReactFlow>
            </div>
            <Legend />
        </div>
    );
}
