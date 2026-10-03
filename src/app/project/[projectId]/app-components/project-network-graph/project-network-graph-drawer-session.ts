'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { TabNavigationUtils } from '@/frontend/utils/tab-navigation.utils';
import {
    appDrawerTabValues,
    AppDrawerNavigationUtils,
    defaultAppDrawerTab,
    type AppDrawerTab,
} from '@/shared/utils/app-drawer-navigation.utils';
import {
    defaultAgentDrawerTab,
    type AgentDrawerTab,
} from '@/shared/utils/agent-drawer-navigation.utils';
import type { NetworkGraphNode } from './project-network-graph-projection';

export const drawerTabValues = appDrawerTabValues;
export type DrawerTab = AppDrawerTab;
export const DrawerSessionUtils = AppDrawerNavigationUtils;

type QueryParams = Pick<URLSearchParams, 'get' | 'toString'>;

type DrawerTarget = { kind: 'APP' | 'AGENT'; id: string };

export function useProjectNetworkGraphDrawerSession({
    searchParams,
    appIds,
    agentIds,
}: {
    searchParams: QueryParams;
    appIds: Set<string>;
    agentIds: Set<string>;
}) {
    const [selectedNodeId, setSelectedNodeId] = useState<string>();
    const [open, setOpen] = useState(false);
    const requestedTab = searchParams.get('drawerTab');

    const updateQuery = useCallback((target?: DrawerTarget, tab?: AppDrawerTab | AgentDrawerTab) => {
        const params = new URLSearchParams(searchParams.toString());
        params.delete('drawerAppId');
        params.delete('drawerAgentId');
        params.delete('drawerTab');

        if (target) {
            params.set(target.kind === 'AGENT' ? 'drawerAgentId' : 'drawerAppId', target.id);
            params.set('drawerTab', tab ?? (target.kind === 'AGENT' ? defaultAgentDrawerTab : defaultAppDrawerTab));
        }

        TabNavigationUtils.replaceQuery(params);
    }, [searchParams]);

    useEffect(() => {
        const requestedAppId = searchParams.get('drawerAppId');
        const requestedAgentId = searchParams.get('drawerAgentId');

        if (requestedAppId) {
            if (!appIds.has(requestedAppId)) {
                updateQuery();
                return;
            }
            setSelectedNodeId(`APP:${requestedAppId}`);
            return;
        }

        if (requestedAgentId) {
            if (!agentIds.has(requestedAgentId)) {
                updateQuery();
                return;
            }
            setSelectedNodeId(`AGENT:${requestedAgentId}`);
        }
    }, [agentIds, appIds, searchParams, updateQuery]);

    useEffect(() => {
        if (selectedNodeId) setOpen(true);
    }, [selectedNodeId]);

    const selectNode = useCallback((node: NetworkGraphNode) => {
        setSelectedNodeId(node.id);
        if (selectedNodeId === node.id) setOpen(true);
        if (node.kind === 'APP') {
            updateQuery({ kind: 'APP', id: node.id.replace('APP:', '') });
        } else if (node.kind === 'AGENT') {
            updateQuery({ kind: 'AGENT', id: node.id.replace('AGENT:', '') });
        } else {
            updateQuery();
        }
    }, [selectedNodeId, updateQuery]);

    const openAppTab = useCallback((appId: string, tab: DrawerTab) => {
        const nodeId = `APP:${appId}`;
        setSelectedNodeId(nodeId);
        if (selectedNodeId === nodeId) setOpen(true);
        updateQuery({ kind: 'APP', id: appId }, tab);
    }, [selectedNodeId, updateQuery]);

    const openAgentTab = useCallback((agentId: string, tab: AgentDrawerTab) => {
        const nodeId = `AGENT:${agentId}`;
        setSelectedNodeId(nodeId);
        if (selectedNodeId === nodeId) setOpen(true);
        updateQuery({ kind: 'AGENT', id: agentId }, tab);
    }, [selectedNodeId, updateQuery]);

    const onOpenChange = useCallback((nextOpen: boolean) => {
        setOpen(nextOpen);
        if (!nextOpen) {
            updateQuery();
        }
    }, [updateQuery]);

    const onOpenChangeComplete = useCallback((nextOpen: boolean) => {
        // Keep the node mounted until Vaul finishes its exit animation. A click
        // during that animation reopens it, so do not clear the new selection.
        if (!nextOpen && !open) setSelectedNodeId(undefined);
    }, [open]);

    return useMemo(() => ({
        selectedNodeId,
        open,
        requestedTab,
        selectNode,
        openAppTab,
        openAgentTab,
        onOpenChange,
        onOpenChangeComplete,
    }), [
        onOpenChange,
        onOpenChangeComplete,
        openAgentTab,
        openAppTab,
        open,
        requestedTab,
        selectNode,
        selectedNodeId,
    ]);
}
