'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { TabNavigationUtils } from '@/frontend/utils/tab-navigation.utils';
import type { NetworkGraphNode } from './project-network-graph-projection';

export const drawerTabValues = [
    'deployments',
    'credentials',
    'logs',
    'stats',
    'settings',
] as const;

export type DrawerTab = (typeof drawerTabValues)[number];

export class DrawerSessionUtils {
    static resolveTab(appType: string | undefined, requestedTab: string | null | undefined): DrawerTab {
        if (!drawerTabValues.includes(requestedTab as DrawerTab)) return 'deployments';
        if (requestedTab === 'credentials' && appType === 'APP') return 'deployments';
        return requestedTab as DrawerTab;
    }
}

type QueryParams = Pick<URLSearchParams, 'get' | 'toString'>;

export function useProjectNetworkGraphDrawerSession({
    searchParams,
    appIds,
}: {
    searchParams: QueryParams;
    appIds: Set<string>;
}) {
    const [selectedNodeId, setSelectedNodeId] = useState<string>();
    const [open, setOpen] = useState(false);
    const requestedTab = searchParams.get('drawerTab');

    const updateQuery = useCallback((appId?: string, tab?: DrawerTab) => {
        const params = new URLSearchParams(searchParams.toString());

        if (!appId) {
            params.delete('drawerAppId');
            params.delete('drawerTab');
        } else {
            params.set('drawerAppId', appId);
            params.set('drawerTab', tab ?? 'deployments');
        }

        TabNavigationUtils.replaceQuery(params);
    }, [searchParams]);

    useEffect(() => {
        const requestedAppId = searchParams.get('drawerAppId');

        if (!requestedAppId) return;
        if (!appIds.has(requestedAppId)) {
            updateQuery();
            return;
        }

        setSelectedNodeId(`APP:${requestedAppId}`);
    }, [appIds, searchParams, updateQuery]);

    useEffect(() => {
        if (selectedNodeId) setOpen(true);
    }, [selectedNodeId]);

    const selectNode = useCallback((node: NetworkGraphNode) => {
        setSelectedNodeId(node.id);
        if (selectedNodeId === node.id) setOpen(true);
        updateQuery(node.kind === 'APP' ? node.id.replace('APP:', '') : undefined);
    }, [selectedNodeId, updateQuery]);

    const openAppTab = useCallback((appId: string, tab: DrawerTab) => {
        const nodeId = `APP:${appId}`;
        setSelectedNodeId(nodeId);
        if (selectedNodeId === nodeId) setOpen(true);
        updateQuery(appId, tab);
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
        onOpenChange,
        onOpenChangeComplete,
    }), [
        onOpenChange,
        onOpenChangeComplete,
        openAppTab,
        open,
        requestedTab,
        selectNode,
        selectedNodeId,
    ]);
}
