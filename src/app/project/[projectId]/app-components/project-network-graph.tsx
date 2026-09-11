'use client';

import type { CSSProperties } from 'react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
    Background,
    BackgroundVariant,
    Controls,
    Handle,
    MarkerType,
    Position,
    ReactFlow,
    useNodesState,
    type Node,
    type NodeProps,
    type NodeTypes,
    type Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Bot, Boxes, Cloud, Database, Edit2, Globe2, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSidebar } from '@/components/ui/sidebar';
import PodStatusIndicator from '@/components/custom/pod-status-indicator';
import { cn } from '@/frontend/utils/utils';
import type { AppExtendedModel } from '@/shared/model/app-extended.model';
import type { UserSession } from '@/shared/model/sim-session.model';
import { UserGroupUtils } from '@/shared/utils/role.utils';
import { InternalHostnameUtils } from '@/server/utils/internal-hostname.utils';
import { NodeDetailsSheet, type PanelConnection } from './project-network-graph/node-details-sheet';
import { connectionDeletionProvenance, NetworkGraphNode } from './project-network-graph/project-network-graph-projection';
import { useProjectNetworkGraph } from './project-network-graph/use-project-network-graph';
import { graphEdgePresentation, graphLegendItems, NETWORK_GRAPH_COLORS } from './project-network-graph/project-network-graph-visual-semantics';
import { useConfirmDialog, useDialog } from '@/frontend/states/zustand.states';
import { Toast } from '@/frontend/utils/toast.utils';
import { AppNetworkPolicyRuleEditModel, NetworkPolicySelectableTarget } from '@/shared/model/app-network-policy-edit.model';
import { NetworkPolicyRuleUtils } from '@/shared/utils/network-policy-rule.utils';
import { AppNetworkPolicyDraft, AppNetworkPolicyDraftUtils } from '@/shared/utils/app-network-policy-draft.utils';
import AppNetworkPolicyRuleDialog from '@/app/project/app/[appId]/advanced/app-network-policy-rule-dialog';
import { saveAppNetworkPolicyConfiguration } from '@/app/project/app/[appId]/advanced/actions';
import { deleteApp } from '@/app/project/[projectId]/actions';
import { EditAppDialog } from './edit-app-dialog';
import type { ProjectNetworkGraphPositions } from '@/shared/model/project-network-graph-layout.model';

const hiddenHandleClassName = '!size-1.5 !border-0 !bg-transparent !opacity-0 pointer-events-none';
const connectionSourceHandleClassName = '!size-3 !border-2 !border-background !bg-qs-500 !opacity-0 !shadow-md transition-all duration-150 group-hover:!opacity-100 [&.connectingfrom]:!opacity-0 hover:!bg-qs-600';
const connectionTargetHandleClassName = '!size-3 !border-2 !border-background !bg-qs-400 !opacity-0 !shadow-md transition-all duration-150 [&.connectingto]:!opacity-100 hover:!bg-qs-500';

type EdgeMenu = { edgeId: string; x: number; y: number };
type NodeMenu = { appId: string; x: number; y: number };
type WorkloadNodeData = NetworkGraphNode & { connectionInProgress?: boolean; connectionTarget?: boolean };
type ProjectNetworkGraphProps = {
    apps: AppExtendedModel[];
    projectId: string;
    session: UserSession;
    savedPositions: ProjectNetworkGraphPositions;
};

const WorkloadNode = memo(function WorkloadNode({
    data,
}: NodeProps<Node<WorkloadNodeData, 'workload'>>) {
    const database = !!data.appType && data.appType.toUpperCase() !== 'APP';
    const Icon = data.kind === 'AGENT' ? Bot : database ? Database : Boxes;
    return (
        <div className={cn('group relative flex w-[240px] cursor-pointer items-center gap-3 rounded-xl border bg-card px-4 py-3.5 shadow-sm transition-all duration-150 hover:border-qs-500/50 hover:shadow-md', data.external && 'border-dashed border-amber-500/70 bg-amber-500/5')}>
            <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg ring-1', data.kind === 'AGENT' ? 'bg-violet-500/15 text-violet-600 ring-violet-500/30' : database ? 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/30' : 'bg-qs-500/10 text-qs-600 ring-qs-500/30')}>
                <Icon className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                    <p className="truncate text-sm font-semibold" title={data.name}>{data.name}</p>
                    {data.kind === 'APP' && <div className={cn('ml-auto shrink-0 transition-opacity', data.connectionTarget && 'opacity-0')}>
                        <PodStatusIndicator appId={data.id.replace('APP:', '')} />
                    </div>}
                </div>
                <p className="truncate text-xs text-muted-foreground">{data.caption ?? (database ? data.appType : data.kind === 'AGENT' ? 'Agent sandbox' : 'App')}</p>
            </div>
            <Handle id="target-ingress" type="target" position={Position.Left} title="Drop connection here" className={cn(data.external ? hiddenHandleClassName : connectionTargetHandleClassName, data.connectionTarget && '!opacity-100')} />
            <Handle id="source-internet" type="source" position={Position.Top} className={hiddenHandleClassName} />
            <Handle id="source-ingress" type="source" position={Position.Bottom} className={hiddenHandleClassName} />
            <Handle id="target-egress" type="target" position={Position.Left} className={hiddenHandleClassName} />
            <Handle id="source-egress" type="source" position={Position.Right} title="Drag to create connection" className={cn(data.external ? hiddenHandleClassName : connectionSourceHandleClassName, data.connectionInProgress && '!opacity-0')} />
        </div>
    );
});
const InternetNode = memo(function InternetNode() {
    return (
        <div className="flex flex-col items-center gap-1.5">
            <div className="flex size-16 items-center justify-center rounded-full border-2 border-dashed border-violet-400 bg-card text-violet-500 shadow-sm">
                <Cloud className="size-7" />
            </div>
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">Internet</span>
            <Handle id="target" type="target" position={Position.Bottom} className={hiddenHandleClassName} style={{ left: '35%' }} />
            <Handle id="source" type="source" position={Position.Bottom} className={hiddenHandleClassName} style={{ left: '65%' }} />
        </div>
    );
});
const nodeTypes = { workload: WorkloadNode, internet: InternetNode } satisfies NodeTypes;

function Legend() {
    return (
        <div className="flex flex-wrap items-center gap-x-[18px] gap-y-1.5 text-xs text-muted-foreground">
            {graphLegendItems.map(item => (
                <span key={item.kind} className="flex items-center gap-1.5">
                    <span
                        className={cn('inline-block w-4 border-t-2', item.kind === 'complete' && 'h-0.5 rounded-full border-0', item.kind !== 'complete' && 'h-0 border-dashed')}
                        style={{
                            borderColor: item.kind === 'internet' ? NETWORK_GRAPH_COLORS.internet : item.kind === 'external' ? NETWORK_GRAPH_COLORS.external : NETWORK_GRAPH_COLORS.connection,
                            background: item.kind === 'complete' ? NETWORK_GRAPH_COLORS.connection : undefined,
                        }}
                    />
                    {item.label}
                </span>
            ))}
            <span>Arrows show allowed traffic direction</span>
        </div>
    );
}

export default function ProjectNetworkGraph(props: ProjectNetworkGraphProps) {
    return <ProjectNetworkGraphEditor key={AppNetworkPolicyDraftUtils.snapshotKey(props.apps)} {...props} />;
}

function ProjectNetworkGraphEditor({
    apps,
    projectId,
    session,
    savedPositions,
}: ProjectNetworkGraphProps) {
    const router = useRouter();
    const { state: sidebarState } = useSidebar();
    const { openDialog } = useDialog();
    const { openConfirmDialog } = useConfirmDialog();
    const [drafts, setDrafts] = useState<Record<string, AppNetworkPolicyDraft>>(() => AppNetworkPolicyDraftUtils.collectionFromApps(apps));
    const [baseline, setBaseline] = useState<Record<string, AppNetworkPolicyDraft>>(() => AppNetworkPolicyDraftUtils.collectionFromApps(apps));
    const [edgeMenu, setEdgeMenu] = useState<EdgeMenu>();
    const [nodeMenu, setNodeMenu] = useState<NodeMenu>();
    const [saving, setSaving] = useState(false);
    const [selectedNodeId, setSelectedNodeId] = useState<string>();
    const [connectionSourceNodeId, setConnectionSourceNodeId] = useState<string>();
    const [connectionTargetNodeId, setConnectionTargetNodeId] = useState<string>();
    const connectionTargetLeaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const graphApps = useMemo(() => apps.map(app => AppNetworkPolicyDraftUtils.applyToApp(app, drafts[app.id])), [apps, drafts]);
    const canEditLayout = UserGroupUtils.sessionHasWriteAccessToProject(session, projectId);
    const { layout, saveNodePosition, resetLayout } = useProjectNetworkGraph(graphApps, projectId, savedPositions);
    const dirty = Object.keys(drafts).some(appId => !AppNetworkPolicyDraftUtils.equals(drafts[appId], baseline[appId]));
    const localAppIds = useMemo(() => new Set(apps.map(app => app.id)), [apps]);
    const writable = (appId: string) => UserGroupUtils.sessionHasWriteAccessForApp(session, appId);
    const writableAppIds = new Set(apps.filter(app => writable(app.id)).map(app => app.id));
    const canRenameApps = UserGroupUtils.sessionCanCreateNewAppsForProject(session, projectId);
    const canDeleteApps = UserGroupUtils.sessionCanDeleteAppsForProject(session, projectId);
    const cancelConnectionTargetLeave = () => {
        if (connectionTargetLeaveTimer.current) clearTimeout(connectionTargetLeaveTimer.current);
    };
    const selectableTargets: NetworkPolicySelectableTarget[] = apps.map(app => ({
        id: app.id,
        name: app.name,
        type: 'APP',
        appType: app.appType,
        project: { id: app.projectId, name: app.project.name },
    }));

    const updateDraft = (appId: string, update: (draft: AppNetworkPolicyDraft) => AppNetworkPolicyDraft) => {
        setDrafts(current => ({ ...current, [appId]: update(current[appId]) }));
    };
    const openConnectionDialog = (sourceAppId: string, targetAppId: string) => {
        const source = apps.find(app => app.id === sourceAppId);
        const target = selectableTargets.find(item => item.id === targetAppId);
        if (!source || !target || !writable(sourceAppId)) return;
        openDialog(<AppNetworkPolicyRuleDialog
            direction="EGRESS"
            targets={selectableTargets.filter(item => item.id !== sourceAppId)}
            currentProject={{ id: source.projectId, name: source.project.name }}
            initialTarget={target}
            isDuplicate={rule => drafts[sourceAppId].rules.some(existing => NetworkPolicyRuleUtils.hasSameContent(
                NetworkPolicyRuleUtils.fromEditRule(existing), NetworkPolicyRuleUtils.fromEditRule(rule),
            ))}
            onAdd={(rule: AppNetworkPolicyRuleEditModel) => updateDraft(
                sourceAppId,
                draft => AppNetworkPolicyDraftUtils.addRule(draft, rule, target),
            )}
        />, { maxWidth: 'max-w-md' });
    };
    const deleteConnection = (edgeId: string) => {
        const edge = layout?.edges.find(item => item.id === edgeId);
        const provenance = connectionDeletionProvenance(edge, writableAppIds);
        if (!provenance) { return; }
        setDrafts(current => AppNetworkPolicyDraftUtils.removeProvenance(current, provenance));
        setEdgeMenu(undefined);
    };
    const deleteLocalApp = async (appId: string) => {
        setNodeMenu(undefined);
        if (!await openConfirmDialog({
            title: 'Delete App',
            description: 'Are you sure you want to delete this app? All data will be lost and this action cannot be undone.',
        })) return;
        await Toast.fromAction(() => deleteApp(appId));
    };
    const toggleInternetAccess = (appId: string) => {
        updateDraft(appId, draft => ({
            ...draft,
            allowInternetAccess: !draft.allowInternetAccess,
        }));
        setNodeMenu(undefined);
    };
    const saveChanges = async () => {
        const changed = Object.values(drafts).filter(draft => !AppNetworkPolicyDraftUtils.equals(draft, baseline[draft.appId]));
        if (!changed.length) { return; }
        if (!await openConfirmDialog({
            title: 'Save & apply network policies?',
            description: 'The changed network policies take effect immediately and will be deployed.',
            okButton: 'Save & Apply',
            cancelButton: 'Cancel'
        })) { return; }
        setSaving(true);
        try {
            await Toast.fromAction(async () => {
                for (const draft of changed) {
                    const result = await saveAppNetworkPolicyConfiguration(undefined, AppNetworkPolicyDraftUtils.toConfiguration(draft));
                    if (result.status !== 'success') return result;
                }
                return { status: 'success' as const };
            }, 'Network policies saved and applied.', 'Applying network policies...');
            setBaseline(drafts);
            router.refresh();
        } finally {
            setSaving(false);
        }
    };
    const discardChanges = () => {
        setDrafts(baseline);
        setEdgeMenu(undefined);
        setConnectionSourceNodeId(undefined);
        setConnectionTargetNodeId(undefined);
    };
    const projectedNodes: Node[] = useMemo(() => (layout?.nodes ?? []).map(node => ({
        id: node.id,
        type: node.kind === 'INTERNET' ? 'internet' : 'workload',
        position: node.position,
        data: node.kind === 'INTERNET' ? node : {
            ...node,
            connectionInProgress: !!connectionSourceNodeId,
            connectionTarget: node.id === connectionTargetNodeId,
        },
    })), [connectionSourceNodeId, connectionTargetNodeId, layout?.nodes]);
    const [nodes, setNodes, onNodesChange] = useNodesState(projectedNodes);
    useEffect(() => setNodes(projectedNodes), [projectedNodes, setNodes]);
    const edges = useMemo(() => (layout?.edges ?? []).map(edge => {
        const presentation = graphEdgePresentation(edge);
        return {
            id: edge.id,
            source: edge.source,
            target: edge.target,
            sourceHandle: presentation.sourceHandle,
            targetHandle: presentation.targetHandle,
            type: 'smoothstep' as const,
            pathOptions: { offset: 20 },
            markerStart: edge.internetIngress ? { type: MarkerType.ArrowClosed, color: presentation.color, width: 16, height: 16 } : undefined,
            markerEnd: edge.direction === 'INTERNET_CONNECTION'
                ? edge.internetEgress ? { type: MarkerType.ArrowClosed, color: presentation.color, width: 16, height: 16 } : undefined
                : { type: MarkerType.ArrowClosed, color: presentation.color, width: 16, height: 16 },
            style: { stroke: presentation.color, strokeWidth: 1.5, strokeDasharray: presentation.dashed ? '5 4' : undefined },
            label: presentation.label,
            labelStyle: { fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: 600 },
            labelBgStyle: { fill: 'hsl(var(--card))', fillOpacity: 0.9, stroke: 'hsl(var(--border))', strokeWidth: 1 },
            labelBgPadding: [6, 3] as [number, number],
            labelBgBorderRadius: 6,
        };
    }), [layout?.edges]);
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
            return {
                id: edge.id,
                name: otherNode?.name ?? 'Unknown workload',
                direction,
                label: graphEdgePresentation(edge).label,
                copyValue
            } satisfies PanelConnection;
        }), [layout, selectedNodeId]);

    return (
        <div className="space-y-2">
            <div className="flex min-h-8 flex-wrap items-center gap-3">
                <Legend />
                <div className="flex-1"></div>
                {canEditLayout && <div className="flex shrink-0 divide-x overflow-hidden rounded-md border bg-background">
                    <Button variant="ghost" size="sm" className="rounded-none border-0 text-muted-foreground shadow-none hover:text-foreground" onClick={resetLayout}>
                        <RotateCcw className="mr-1.5 size-3.5" />
                        Reset
                    </Button>
                </div>}
                {dirty && <>
                    <div className="flex shrink-0 divide-x overflow-hidden rounded-md border bg-background">
                        <Button
                            size="sm"
                            disabled={saving}
                            className={cn(
                                'rounded-none border-0 shadow-none',
                                dirty
                                    ? 'bg-qs-600 text-white hover:bg-qs-700 disabled:bg-qs-600 disabled:text-white'
                                    : 'bg-muted text-muted-foreground hover:bg-muted hover:text-muted-foreground',
                            )}
                            onClick={() => void saveChanges()}
                        >
                            Save & Apply
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            disabled={saving}
                            className="rounded-none border-0 text-muted-foreground shadow-none hover:text-foreground"
                            onClick={discardChanges}
                        >
                            Cancel
                        </Button>
                    </div>
                </>}
            </div>
            <div className={cn(
                'relative left-1/2 h-[calc(100dvh-14rem)] min-h-80 w-screen -translate-x-1/2 overflow-hidden bg-background transition-[width] duration-200',
                sidebarState === 'expanded'
                    ? 'md:w-[calc(100vw-var(--sidebar-width))]'
                    : 'md:w-[calc(100vw-var(--sidebar-width-icon))]',
            )}>
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    nodeTypes={nodeTypes}
                    fitView
                    fitViewOptions={{ padding: 0.2, maxZoom: 1.1 }}
                    minZoom={0.3}
                    maxZoom={1.5}
                    zoomOnScroll={false}
                    zoomOnPinch={false}
                    zoomOnDoubleClick={false}
                    preventScrolling={false}
                    nodesDraggable={canEditLayout}
                    nodesConnectable
                    elementsSelectable={false}
                    isValidConnection={(connection: Connection) => {
                        const source = connection.source?.replace('APP:', '');
                        const target = connection.target?.replace('APP:', '');
                        return connection.sourceHandle === 'source-egress'
                            && connection.targetHandle === 'target-ingress'
                            && !!source
                            && !!target
                            && source !== target
                            && localAppIds.has(source)
                            && localAppIds.has(target)
                            && writable(source);
                    }}
                    onConnect={(connection: Connection) => {
                        const source = connection.source?.replace('APP:', '');
                        const target = connection.target?.replace('APP:', '');
                        if (source && target) openConnectionDialog(source, target);
                    }}
                    onConnectStart={(_event, { nodeId, handleId }) => {
                        if (handleId === 'source-egress') {
                            cancelConnectionTargetLeave();
                            setConnectionSourceNodeId(nodeId ?? undefined);
                        }
                    }}
                    onConnectEnd={() => {
                        cancelConnectionTargetLeave();
                        setConnectionSourceNodeId(undefined);
                        setConnectionTargetNodeId(undefined);
                    }}
                    onEdgeContextMenu={(event, edge) => {
                        event.preventDefault();
                        setNodeMenu(undefined);
                        const graphEdge = layout?.edges.find(item => item.id === edge.id);
                        if (connectionDeletionProvenance(graphEdge, writableAppIds)) {
                            setEdgeMenu({ edgeId: edge.id, x: event.clientX, y: event.clientY });
                        }
                    }}
                    onNodeContextMenu={(event, node) => {
                        event.preventDefault();
                        setEdgeMenu(undefined);
                        const data = node.data as NetworkGraphNode;
                        const appId = data.kind === 'APP' ? data.id.replace('APP:', '') : undefined;
                        if (appId && localAppIds.has(appId) && (canRenameApps || canDeleteApps || writable(appId))) {
                            setNodeMenu({ appId, x: event.clientX, y: event.clientY });
                        } else {
                            setNodeMenu(undefined);
                        }
                    }}
                    onPaneClick={() => {
                        setEdgeMenu(undefined);
                        setNodeMenu(undefined);
                    }}
                    onNodeMouseEnter={(_event, node) => {
                        cancelConnectionTargetLeave();
                        const source = connectionSourceNodeId?.replace('APP:', '');
                        const target = node.id.replace('APP:', '');
                        if (source && source !== target && localAppIds.has(source) && localAppIds.has(target) && writable(source)) {
                            setConnectionTargetNodeId(node.id);
                        }
                    }}
                    onNodeMouseLeave={(_event, node) => {
                        cancelConnectionTargetLeave();
                        connectionTargetLeaveTimer.current = setTimeout(() => {
                            setConnectionTargetNodeId(current => current === node.id ? undefined : current);
                        }, 100);
                    }}
                    onNodeDragStop={canEditLayout ? (_event, node) => void saveNodePosition(node.id, node.position) : undefined}
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
                    <Background variant={BackgroundVariant.Dots} gap={22} size={1.5} color="hsl(var(--muted-foreground) / 0.35)" />
                    <Controls showInteractive={false} />
                </ReactFlow>
                {edgeMenu && createPortal(
                    <div className="fixed z-50 rounded-md border bg-popover p-1 shadow-md" style={{ left: edgeMenu.x, top: edgeMenu.y }}>
                        <Button variant="ghost" size="sm" className="w-full justify-start text-destructive" onClick={() => deleteConnection(edgeMenu.edgeId)}>
                            <Trash2 className="mr-2 size-4" /> Delete connection
                        </Button>
                    </div>,
                    document.body,
                )}
                {nodeMenu && (() => {
                    const app = apps.find(item => item.id === nodeMenu.appId);
                    const draft = drafts[nodeMenu.appId];
                    if (!app || !draft) return null;
                    return createPortal(
                        <div className="fixed z-50 min-w-44 rounded-md border bg-popover p-1 shadow-md" style={{ left: nodeMenu.x, top: nodeMenu.y }}>
                            {writable(app.id) && <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => toggleInternetAccess(app.id)}>
                                <Globe2 className="mr-2 size-4" />
                                {draft.allowInternetAccess ? 'Disable' : 'Enable'} Egress Internet Access
                            </Button>}
                            {canRenameApps && <EditAppDialog projectId={projectId} existingItem={app}>
                                <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => setNodeMenu(undefined)}>
                                    <Edit2 className="mr-2 size-4" /> Edit App Name
                                </Button>
                            </EditAppDialog>}
                            {canDeleteApps && <Button variant="ghost" size="sm" className="w-full justify-start text-destructive" onClick={() => void deleteLocalApp(app.id)}>
                                <Trash2 className="mr-2 size-4" /> Delete App
                            </Button>}
                        </div>,
                        document.body,
                    );
                })()}
                {edges.length === 0 && <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground"><Cloud className="size-6 opacity-40" /><p>No active network policy connections yet.</p></div>}
                {selectedNode && <NodeDetailsSheet
                    node={selectedNode}
                    app={selectedApp}
                    role={selectedAppRole}
                    connections={selectedConnections}
                    open
                    onOpenChange={open => { if (!open) setSelectedNodeId(undefined); }}
                    onOpen={() => router.push(`/project/app/${selectedNode.id.replace('APP:', '')}`)} />}
            </div>
        </div>
    );
}
