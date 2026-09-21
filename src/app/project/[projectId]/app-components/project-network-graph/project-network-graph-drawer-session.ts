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

    const selectNode = useCallback((node: NetworkGraphNode) => {
        setSelectedNodeId(node.id);
        updateQuery(node.kind === 'APP' ? node.id.replace('APP:', '') : undefined);
    }, [updateQuery]);

    const openAppTab = useCallback((appId: string, tab: DrawerTab) => {
        setSelectedNodeId(`APP:${appId}`);
        updateQuery(appId, tab);
    }, [updateQuery]);

    const onOpenChange = useCallback((nextOpen: boolean) => {
        if (!nextOpen) {
            setSelectedNodeId(undefined);
            updateQuery();
        }
    }, [updateQuery]);

    const onOpenChangeComplete = useCallback(() => {}, []);

    return useMemo(() => ({
        selectedNodeId,
        open: selectedNodeId !== undefined,
        requestedTab,
        selectNode,
        openAppTab,
        onOpenChange,
        onOpenChangeComplete,
    }), [
        onOpenChange,
        onOpenChangeComplete,
        openAppTab,
        requestedTab,
        selectNode,
        selectedNodeId,
    ]);
}
