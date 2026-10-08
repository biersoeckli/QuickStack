'use client';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    Background,
    BackgroundVariant,
    Controls,
    MarkerType,
    ReactFlow,
    SmoothStepEdge,
    useNodesState,
    type Node,
    type NodeTypes,
    type EdgeProps,
    type Connection,
    type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Cloud, Info, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardFooter } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/frontend/utils/utils';
import type { AppExtendedModel } from '@/shared/model/app-extended.model';
import type { AgentExtendedModel } from '@/shared/model/agent-extended.model';
import type { UserSession } from '@/shared/model/sim-session.model';
import { UserGroupUtils } from '@/shared/utils/role.utils';
import { RolePermissionEnum } from '@/shared/model/role-extended.model.ts';
import { ProjectNetworkGraphConnectionContextMenu } from './project-network-graph/context-menus/project-network-graph-connection-context-menu';
import { connectionDeletionProvenance, type NetworkGraphEdge, NetworkGraphNode } from './project-network-graph/project-network-graph-projection';
import { useProjectNetworkGraph } from './project-network-graph/use-project-network-graph';
import { graphEdgePresentation, graphLegendItems, NETWORK_GRAPH_COLORS } from './project-network-graph/project-network-graph-visual-semantics';
import { getFocusedNodeViewport } from './project-network-graph/project-network-graph-focus';
import { useConfirmDialog, useDialog } from '@/frontend/states/zustand.states';
import { Toast } from '@/frontend/utils/toast.utils';
import { AppNetworkPolicyRuleEditModel, NetworkPolicySelectableTarget } from '@/shared/model/app-network-policy-edit.model';
import { NetworkPolicyRuleUtils } from '@/shared/utils/network-policy-rule.utils';
import { AppNetworkPolicyDraft, AppNetworkPolicyDraftUtils } from '@/shared/utils/app-network-policy-draft.utils';
import { InternalHostnameUtils } from '@/shared/utils/internal-hostname.utils';
import AppNetworkPolicyRuleDialog from '@/app/project/app/[appId]/advanced/app-network-policy-rule-dialog';
import { saveAppNetworkPolicyConfiguration } from '@/app/project/app/[appId]/advanced/actions';
import { deleteApp } from '@/app/project/[projectId]/actions';
import type { ProjectNetworkGraphPositions } from '@/shared/model/project-network-graph-layout.model';
import type { S3Target } from '@prisma/client';
import type { VolumeBackupExtendedModel } from '@/shared/model/volume-backup-extended.model';
import {
    type DrawerTab,
    useProjectNetworkGraphDrawerSession,
} from './project-network-graph/project-network-graph-drawer-session';
import { AppDetailsDrawer } from './app-drawer-components/app-details-drawer';
import { AgentSandboxDrawer } from '@/app/project/[projectId]/agent-components/agent-drawer-components/agent-sandbox-drawer';
import { deleteAgent } from '@/app/project/[projectId]/agent-components/agent-drawer-components/agent-actions';
import type { AgentSandboxTemplateInfo } from '@/shared/model/agent-sandbox-template-info.model';
import type { AgentDrawerTab } from '@/shared/utils/agent-drawer-navigation.utils';
import { ProjectNetworkGraphCanvasContextMenu } from './project-network-graph/context-menus/project-network-graph-canvas-context-menu';
import { ProjectNetworkGraphAppWorkloadNode } from './project-network-graph/nodes/project-network-graph-app-workload-node';
import { ProjectNetworkGraphAgentWorkloadNode } from './project-network-graph/nodes/project-network-graph-agent-workload-node';
import { ProjectNetworkGraphInternetNode } from './project-network-graph/nodes/project-network-graph-internet-node';

type ConnectionEdgeData = {
    onDelete?: () => void;
    internalHostnames: { hostname: string; port: number }[];
};

type ProjectNetworkGraphProps = {
    apps: AppExtendedModel[];
    agents: AgentExtendedModel[];
    agentsAvailable: boolean;
    projectId: string;
    session: UserSession;
    savedPositions: ProjectNetworkGraphPositions;
    s3Targets: S3Target[];
    storageClasses: string[];
    runtimeClasses: string[];
    volumeBackupsByApp: Record<string, VolumeBackupExtendedModel[]>;
    gitSshPublicKeysByApp: Record<string, string | undefined>;
    agentTemplateInfoByAgent: Record<string, AgentSandboxTemplateInfo | undefined>;
};

function stripWorkloadPrefix(nodeId: string | undefined) {
    if (!nodeId) return undefined;
    const separatorIndex = nodeId.indexOf(':');
    return separatorIndex >= 0 ? nodeId.slice(separatorIndex + 1) : nodeId;
}

const nodeTypes = {
    'app-workload': ProjectNetworkGraphAppWorkloadNode,
    'agent-workload': ProjectNetworkGraphAgentWorkloadNode,
    internet: ProjectNetworkGraphInternetNode,
} satisfies NodeTypes;

function ConnectionEdge(props: EdgeProps) {
    const data = props.data as ConnectionEdgeData | undefined;
    if (!data) return <SmoothStepEdge {...props} />;
    return (
        <ProjectNetworkGraphConnectionContextMenu
            onDelete={data.onDelete}
            internalHostnames={data.internalHostnames}
        >
            <SmoothStepEdge {...props} />
        </ProjectNetworkGraphConnectionContextMenu>
    );
}

function getInternalHostnames(
    edge: NetworkGraphEdge,
    drafts: Record<string, AppNetworkPolicyDraft>,
    apps: AppExtendedModel[],
) {
    const hostnames = new Map<string, { hostname: string; port: number }>();

    for (const provenance of edge.ruleProvenance) {
        const rule = drafts[provenance.ownerAppId]?.rules.find(item => item.key === provenance.ruleKey);
        if (!rule) continue;

        const target = rule.type === 'INGRESS'
            ? apps.find(app => app.id === provenance.ownerAppId)
            : rule.targetType === 'APP'
                ? { id: rule.targetId, projectId: rule.targetProjectId }
                : undefined;
        if (!target?.projectId) continue;

        const hostname = InternalHostnameUtils.getInternalBaseUrlForApp(target, rule.port);
        hostnames.set(hostname, { hostname, port: rule.port });
    }

    return Array.from(hostnames.values()).sort((left, right) => left.port - right.port);
}
const edgeTypes = { connection: ConnectionEdge };

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
    return <ProjectNetworkGraphEditor
        key={AppNetworkPolicyDraftUtils.snapshotKey(props.apps)}
        {...props} />;
}

function ProjectNetworkGraphEditor({
    apps,
    agents,
    agentsAvailable,
    projectId,
    session,
    savedPositions,
    s3Targets,
    storageClasses,
    runtimeClasses,
    volumeBackupsByApp,
    gitSshPublicKeysByApp,
    agentTemplateInfoByAgent,
}: ProjectNetworkGraphProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { openDialog } = useDialog();
    const { openConfirmDialog } = useConfirmDialog();
    const [drafts, setDrafts] = useState<Record<string, AppNetworkPolicyDraft>>(() => AppNetworkPolicyDraftUtils.collectionFromApps(apps));
    const [baseline, setBaseline] = useState<Record<string, AppNetworkPolicyDraft>>(() => AppNetworkPolicyDraftUtils.collectionFromApps(apps));
    const [saving, setSaving] = useState(false);
    const [connectionSourceNodeId, setConnectionSourceNodeId] = useState<string>();
    const [connectionTargetNodeId, setConnectionTargetNodeId] = useState<string>();
    const [environmentAppId, setEnvironmentAppId] = useState<string>();
    const [graphHeight, setGraphHeight] = useState<number>();
    const graphContainerRef = useRef<HTMLDivElement>(null);
    const drawerContentRef = useRef<HTMLDivElement>(null);
    const reactFlowRef = useRef<Pick<ReactFlowInstance, 'getNode' | 'getZoom' | 'setViewport'>>(null);
    const connectionTargetLeaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const graphApps = useMemo(() => apps.map(app => AppNetworkPolicyDraftUtils.applyToApp(app, drafts[app.id])), [apps, drafts]);
    const canEditLayout = UserGroupUtils.sessionHasWriteAccessToProject(session, projectId);
    const canCreateApps = UserGroupUtils.sessionCanCreateNewAppsForProject(session, projectId);
    const canCreateAgents = agentsAvailable && UserGroupUtils.sessionCanCreateProjectWorkloadsForProject(session, projectId);
    const { layout, saveNodePosition, resetLayout } = useProjectNetworkGraph(graphApps, agents, projectId, savedPositions);
    const dirty = Object.keys(drafts).some(appId => !AppNetworkPolicyDraftUtils.equals(drafts[appId], baseline[appId]));
    const localAppIds = useMemo(() => new Set(apps.map(app => app.id)), [apps]);
    const localAgentIds = useMemo(() => new Set(agents.map(agent => agent.id)), [agents]);
    const localWorkloadIds = useMemo(() => new Set([
        ...apps.map(app => app.id),
        ...agents.map(agent => agent.id),
    ]), [apps, agents]);
    const drawerSession = useProjectNetworkGraphDrawerSession({
        searchParams,
        appIds: localAppIds,
        agentIds: localAgentIds,
    });
    const { selectedNodeId } = drawerSession;
    const writable = useCallback(
        (appId: string) => UserGroupUtils.sessionHasWriteAccessForApp(session, appId),
        [session],
    );
    const writableAppIds = useMemo(
        () => new Set(apps.filter(app => writable(app.id)).map(app => app.id)),
        [apps, writable],
    );

    useLayoutEffect(() => {
        const updateGraphHeight = () => {
            const graphContainer = graphContainerRef.current;
            if (!graphContainer) return;

            setGraphHeight(Math.max(0, window.innerHeight - graphContainer.getBoundingClientRect().top));
        };

        updateGraphHeight();
        window.addEventListener('resize', updateGraphHeight);
        return () => window.removeEventListener('resize', updateGraphHeight);
    }, []);
    const cancelConnectionTargetLeave = () => {
        if (connectionTargetLeaveTimer.current) clearTimeout(connectionTargetLeaveTimer.current);
    };
    const selectableTargets: NetworkPolicySelectableTarget[] = [
        ...apps.map(app => ({
            id: app.id,
            name: app.name,
            type: 'APP' as const,
            appType: app.appType,
            project: { id: app.projectId, name: app.project.name },
        })),
        ...agents.map(agent => ({
            id: agent.id,
            name: agent.name,
            type: 'AGENT' as const,
            project: { id: agent.projectId, name: agent.project.name },
        })),
    ];

    const updateDraft = useCallback((appId: string, update: (draft: AppNetworkPolicyDraft) => AppNetworkPolicyDraft) => {
        setDrafts(current => ({ ...current, [appId]: update(current[appId]) }));
    }, []);
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
    const deleteConnection = useCallback((edgeId: string) => {
        const edge = layout?.edges.find(item => item.id === edgeId);
        const provenance = connectionDeletionProvenance(edge, writableAppIds);
        if (!provenance) { return; }
        setDrafts(current => AppNetworkPolicyDraftUtils.removeProvenance(current, provenance));
    }, [layout?.edges, writableAppIds]);
    const deleteLocalApp = useCallback(async (appId: string) => {
        if (!await openConfirmDialog({
            title: 'Delete App',
            description: 'Are you sure you want to delete this app? All data will be lost and this action cannot be undone.',
        })) return;
        await Toast.fromAction(() => deleteApp(appId));
    }, [openConfirmDialog]);
    const deleteLocalAgent = useCallback(async (agentId: string) => {
        if (!await openConfirmDialog({
            title: 'Delete Agent Sandbox',
            description: 'Are you sure you want to delete this Agent Sandbox? All data will be lost and this action cannot be undone.',
            okButton: 'Delete Agent Sandbox',
        })) return;
        await Toast.fromAction(() => deleteAgent(agentId), 'Agent Sandbox deleted successfully.');
    }, [openConfirmDialog]);
    const toggleInternetAccess = useCallback((appId: string) => {
        updateDraft(appId, draft => ({
            ...draft,
            allowInternetAccess: !draft.allowInternetAccess,
        }));
    }, [updateDraft]);
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
        setConnectionSourceNodeId(undefined);
        setConnectionTargetNodeId(undefined);
    };
    const projectedNodes: Node[] = useMemo(() => (layout?.nodes ?? []).map(node => {
        const appId = node.kind === 'APP' ? node.id.replace('APP:', '') : undefined;
        const app = appId ? apps.find(item => item.id === appId) : undefined;
        const draft = app ? drafts[app.id] : undefined;
        const appRole = app
            ? UserGroupUtils.getRolePermissionForApp(session, app.id) ?? undefined
            : undefined;
        const agentId = node.kind === 'AGENT' ? node.id.replace('AGENT:', '') : undefined;
        const agent = agentId ? agents.find(item => item.id === agentId) : undefined;
        const agentRole = agent
            ? UserGroupUtils.getRolePermissionForProjectWorkload(session, agent.id) ?? undefined
            : undefined;
        return {
            id: node.id,
            type: node.kind === 'INTERNET'
                ? 'internet'
                : node.kind === 'AGENT'
                    ? 'agent-workload'
                    : 'app-workload',
            position: node.position,
            data: {
                ...node,
                connectionInProgress: !!connectionSourceNodeId,
                connectionTarget: node.id === connectionTargetNodeId,
                selected: node.id === selectedNodeId,
                appContextMenu: app && draft && appRole === RolePermissionEnum.READWRITE ? {
                    app,
                    role: appRole,
                    allowInternetAccess: draft.allowInternetAccess,
                    onToggleInternetAccess: () => toggleInternetAccess(app.id),
                    onOpenDrawerTab: (tab: DrawerTab) => {
                        drawerSession.openAppTab(app.id, tab);
                    },
                    onShowEnvironment: () => {
                        setEnvironmentAppId(app.id);
                        drawerSession.openAppTab(app.id, 'settings');
                    },
                    onDelete: () => void deleteLocalApp(app.id),
                } : undefined,
                agentContextMenu: agent && agentRole === RolePermissionEnum.READWRITE ? {
                    agent,
                    onOpenDrawerTab: (tab: AgentDrawerTab) => drawerSession.openAgentTab(agent.id, tab),
                    onDelete: () => void deleteLocalAgent(agent.id),
                } : undefined,
                connectedToSelection: !selectedNodeId || (layout?.edges ?? []).some(edge =>
                    (edge.source === selectedNodeId && edge.target === node.id)
                    || (edge.target === selectedNodeId && edge.source === node.id),
                ),
            },
        };
    }), [agents, apps, connectionSourceNodeId, connectionTargetNodeId, deleteLocalAgent, deleteLocalApp, drafts, drawerSession, layout?.edges, layout?.nodes, selectedNodeId, session, toggleInternetAccess]);

    const [nodes, setNodes, onNodesChange] = useNodesState(projectedNodes);
    useEffect(() => setNodes(projectedNodes), [projectedNodes, setNodes]);

    const edges = useMemo(() => (layout?.edges ?? []).map(edge => {
        const presentation = graphEdgePresentation(edge);
        const deletionProvenance = connectionDeletionProvenance(edge, writableAppIds);
        const internalHostnames = getInternalHostnames(edge, drafts, apps);
        return {
            id: edge.id,
            source: edge.source,
            target: edge.target,
            sourceHandle: presentation.sourceHandle,
            targetHandle: presentation.targetHandle,
            type: edge.direction === 'CONNECTION' && (deletionProvenance || internalHostnames.length > 0)
                ? 'connection'
                : 'smoothstep',
            data: edge.direction === 'CONNECTION' && (deletionProvenance || internalHostnames.length > 0)
                ? {
                    ...(deletionProvenance ? { onDelete: () => deleteConnection(edge.id) } : {}),
                    internalHostnames,
                }
                : undefined,
            pathOptions: { offset: 20 },
            markerStart: edge.internetIngress ? { type: MarkerType.ArrowClosed, color: presentation.color, width: 16, height: 16 } : undefined,
            markerEnd: edge.direction === 'INTERNET_CONNECTION'
                ? edge.internetEgress ? { type: MarkerType.ArrowClosed, color: presentation.color, width: 16, height: 16 } : undefined
                : { type: MarkerType.ArrowClosed, color: presentation.color, width: 16, height: 16 },
            style: {
                stroke: presentation.color,
                strokeWidth: selectedNodeId && (edge.source === selectedNodeId || edge.target === selectedNodeId) ? 2.5 : 1.5,
                strokeDasharray: presentation.dashed ? '5 4' : undefined,
                opacity: selectedNodeId && edge.source !== selectedNodeId && edge.target !== selectedNodeId ? 0.2 : 1,
            },
            label: presentation.label,
            labelStyle: { fill: 'var(--muted-foreground)', fontSize: 10, fontWeight: 600 },
            labelBgStyle: { fill: 'var(--card)', fillOpacity: 0.9, stroke: 'var(--border)', strokeWidth: 1 },
            labelBgPadding: [6, 3] as [number, number],
            labelBgBorderRadius: 6,
        };
    }), [apps, deleteConnection, drafts, layout?.edges, selectedNodeId, writableAppIds]);

    const selectedNode = nodes.find(node => node.id === selectedNodeId)?.data as NetworkGraphNode | undefined;
    const selectedApp = selectedNode?.kind === 'APP' ? apps.find(app => app.id === selectedNode.id.replace('APP:', '')) : undefined;
    const selectedAppRole = selectedApp ? UserGroupUtils.getRolePermissionForApp(session, selectedApp.id) ?? undefined : undefined;
    const selectedAgent = selectedNode?.kind === 'AGENT' ? agents.find(agent => agent.id === selectedNode.id.replace('AGENT:', '')) : undefined;
    const selectedAgentRole = selectedAgent ? UserGroupUtils.getRolePermissionForProjectWorkload(session, selectedAgent.id) ?? undefined : undefined;

    useEffect(() => {
        if (!selectedNodeId || selectedNode?.kind !== 'APP') return;
        if (!window.matchMedia('(min-width: 1024px)').matches) return;

        const animationFrame = requestAnimationFrame(() => {
            const reactFlow = reactFlowRef.current;
            const graphContainer = graphContainerRef.current;
            const drawerContent = drawerContentRef.current;
            const selectedReactFlowNode = reactFlow?.getNode(selectedNodeId);
            if (!reactFlow || !graphContainer || !drawerContent || !selectedReactFlowNode) return;

            const graphBounds = graphContainer.getBoundingClientRect();
            const drawerWidth = drawerContent.getBoundingClientRect().width;
            const nodeWidth = selectedReactFlowNode.measured?.width ?? 240;
            const nodeHeight = selectedReactFlowNode.measured?.height ?? 68;
            const viewport = getFocusedNodeViewport({
                node: {
                    x: selectedReactFlowNode.position.x,
                    y: selectedReactFlowNode.position.y,
                    width: nodeWidth,
                    height: nodeHeight,
                },
                graphWidth: graphBounds.width,
                graphHeight: graphBounds.height,
                drawerWidth,
            });

            void reactFlow.setViewport(viewport, { duration: 300 });
        });

        return () => cancelAnimationFrame(animationFrame);
    }, [selectedNode, selectedNodeId]);

    return (
        <div>
            <div
                ref={graphContainerRef}
                className="relative -mx-8 w-auto overflow-hidden bg-background lg:-mx-10"
                style={{ height: graphHeight ?? 'calc(100dvh - 14rem)' }}
            >
                <div className="absolute right-4 top-4 z-10 flex overflow-hidden rounded-md border bg-background shadow-xs">
                    <Popover>
                        <PopoverTrigger render={<Button variant="ghost" size="sm" className="rounded-none border-0 text-muted-foreground shadow-none hover:text-foreground">
                            <Info className="mr-1.5 size-3.5" />
                            Legend
                        </Button>} />
                        <PopoverContent align="end" className="w-auto p-3">
                            <Legend />
                        </PopoverContent>
                    </Popover>
                    {canEditLayout && <Button variant="ghost" size="sm" className="rounded-none border-0 border-l text-muted-foreground shadow-none hover:text-foreground" onClick={resetLayout}>
                        <RotateCcw className="mr-1.5 size-3.5" />
                        Reset
                    </Button>}
                </div>
                <ProjectNetworkGraphCanvasContextMenu
                    projectId={projectId}
                    canCreateApps={canCreateApps}
                    canCreateAgents={canCreateAgents}
                >
                    <ReactFlow
                        onInit={instance => { reactFlowRef.current = instance; }}
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        nodeTypes={nodeTypes}
                        edgeTypes={edgeTypes}
                        fitView
                        fitViewOptions={{ padding: 0.2, maxZoom: 1.1 }}
                        minZoom={0.3}
                        maxZoom={1.5}
                        zoomOnScroll
                        zoomOnPinch={false}
                        zoomOnDoubleClick={false}
                        preventScrolling
                        nodesDraggable={canEditLayout}
                        nodesConnectable
                        elementsSelectable={false}
                        isValidConnection={(connection: Connection) => {
                            const source = stripWorkloadPrefix(connection.source);
                            const target = stripWorkloadPrefix(connection.target);
                            return connection.sourceHandle === 'source-egress'
                                && connection.targetHandle === 'target-ingress'
                                && !!source
                                && !!target
                                && source !== target
                                && localAppIds.has(source)
                                && localWorkloadIds.has(target)
                                && writable(source);
                        }}
                        onConnect={(connection: Connection) => {
                            const source = stripWorkloadPrefix(connection.source);
                            const target = stripWorkloadPrefix(connection.target);
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
                        onPaneClick={() => {
                        }}
                        onNodeMouseEnter={(_event, node) => {
                            cancelConnectionTargetLeave();
                            const source = stripWorkloadPrefix(connectionSourceNodeId);
                            const target = stripWorkloadPrefix(node.id);
                            if (source && target && source !== target && localAppIds.has(source) && localWorkloadIds.has(target) && writable(source)) {
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
                            '--xy-controls-button-background-color': 'var(--secondary)',
                            '--xy-controls-button-background-color-hover': 'var(--accent)',
                            '--xy-controls-button-color': 'var(--secondary-foreground)',
                            '--xy-controls-button-border-color': 'var(--border)',
                            '--xy-controls-box-shadow': '0 1px 3px 0 rgb(0 0 0 / 0.1)',
                        } as CSSProperties}
                        onNodeClick={(_event, node) => {
                            const data = node.data as NetworkGraphNode;
                            if (data.kind === 'INTERNET') return;
                            drawerSession.selectNode(data);
                        }}
                    >
                        <Background variant={BackgroundVariant.Dots} gap={22} size={1.5} color="color-mix(in oklab, var(--muted-foreground) 35%, transparent)" />
                        <Controls showInteractive={false} />
                    </ReactFlow>
                </ProjectNetworkGraphCanvasContextMenu>
                {dirty && (
                    <Card className="absolute bottom-4 left-16 z-10 flex w-fit overflow-hidden p-1 shadow-md">
                        <CardFooter className="p-0">
                            <Button
                                size="sm"
                                disabled={saving}
                                className="bg-qs-600 text-white hover:bg-qs-700 disabled:bg-qs-600 disabled:text-white"
                                onClick={() => void saveChanges()}
                            >
                                Save & Apply
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                disabled={saving}
                                className="text-muted-foreground hover:text-foreground ml-2"
                                onClick={discardChanges}
                            >
                                Cancel
                            </Button>
                        </CardFooter>
                    </Card>
                )}
                {edges.length === 0 && nodes.length === 0 && <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
                    <Cloud className="size-6 opacity-40" /><p>No active network policy connections yet.</p>
                </div>}
                {selectedNode && selectedNode.kind === 'APP' && <AppDetailsDrawer
                    contentRef={drawerContentRef}
                    node={selectedNode}
                    app={selectedApp}
                    role={selectedAppRole}
                    s3Targets={s3Targets}
                    storageClasses={storageClasses}
                    volumeBackups={selectedApp ? (volumeBackupsByApp[selectedApp.id] ?? []) : []}
                    gitSshPublicKey={selectedApp ? gitSshPublicKeysByApp[selectedApp.id] : undefined}
                    open={drawerSession.open}
                    onOpenChange={drawerSession.onOpenChange}
                    onOpenChangeComplete={drawerSession.onOpenChangeComplete}
                    requestedTab={drawerSession.requestedTab}
                    onTabChange={tab => {
                        if (selectedApp) drawerSession.openAppTab(selectedApp.id, tab);
                    }}
                    openEnvironment={environmentAppId === selectedApp?.id}
                    onEnvironmentOpened={() => setEnvironmentAppId(undefined)}
                />}
                {selectedNode && selectedNode.kind === 'AGENT' && <AgentSandboxDrawer
                    contentRef={drawerContentRef}
                    agent={selectedAgent}
                    role={selectedAgentRole}
                    templateInfo={selectedAgent ? agentTemplateInfoByAgent[selectedAgent.id] : undefined}
                    storageClasses={storageClasses}
                    runtimeClasses={runtimeClasses}
                    open={drawerSession.open}
                    onOpenChange={drawerSession.onOpenChange}
                    onOpenChangeComplete={drawerSession.onOpenChangeComplete}
                    requestedTab={drawerSession.requestedTab}
                    onTabChange={tab => {
                        if (selectedAgent) drawerSession.openAgentTab(selectedAgent.id, tab);
                    }}
                />}
            </div>
        </div>
    );
}
