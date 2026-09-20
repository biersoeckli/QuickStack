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
        if (requestedTab === 'credentials' && appType !== 'APP') {
            return 'credentials';
        }

        if (
            requestedTab !== 'credentials'
            && drawerTabValues.includes(requestedTab as DrawerTab)
        ) {
            return requestedTab as DrawerTab;
        }

        return 'deployments';
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
    const [requestedTab, setRequestedTab] = useState<string | null>(
        () => searchParams.get('drawerTab'),
    );

    const updateQuery = useCallback((appId?: string, tab?: DrawerTab) => {
        setRequestedTab(appId ? (tab ?? 'deployments') : null);
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
        setRequestedTab(searchParams.get('drawerTab'));
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
        updateQuery(node.kind === 'APP' ? node.id.replace('APP:', '') : undefined);
    }, [updateQuery]);

    const openAppTab = useCallback((appId: string, tab: DrawerTab) => {
        setSelectedNodeId(`APP:${appId}`);
        updateQuery(appId, tab);
    }, [updateQuery]);

    const onOpenChange = useCallback((nextOpen: boolean) => {
        setOpen(nextOpen);
        if (!nextOpen) updateQuery();
    }, [updateQuery]);

    const onOpenChangeComplete = useCallback((nextOpen: boolean) => {
        if (!nextOpen) setSelectedNodeId(undefined);
    }, []);

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
        open,
        openAppTab,
        requestedTab,
        selectNode,
        selectedNodeId,
    ]);
}
