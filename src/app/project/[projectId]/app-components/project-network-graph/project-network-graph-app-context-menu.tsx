'use client';

import type { ReactNode } from 'react';
import { Box, Globe2, Hammer, Logs, Play, Rocket, Settings, Square, Trash2 } from 'lucide-react';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuSub,
    ContextMenuSubContent,
    ContextMenuSubTrigger,
    ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { deploy, startApp, stopApp } from '@/app/project/app/[appId]/actions';
import { usePodsStatus } from '@/frontend/states/zustand.states';
import { AppLifecycleUtils } from '@/frontend/utils/app-lifecycle.utils';
import { Toast } from '@/frontend/utils/toast.utils';
import type { AppExtendedModel } from '@/shared/model/app-extended.model';
import { RolePermissionEnum } from '@/shared/model/role-extended.model.ts';

export type ProjectNetworkGraphAppContextMenuProps = {
    app: AppExtendedModel;
    role?: RolePermissionEnum;
    allowInternetAccess: boolean;
    onToggleInternetAccess: () => void;
    onOpenDrawerTab: (tab: 'deployments' | 'logs' | 'settings') => void;
    onDelete: () => void;
    children: ReactNode;
};

export function ProjectNetworkGraphAppContextMenu({
    app,
    role,
    allowInternetAccess,
    onToggleInternetAccess,
    onDelete,
    children,
    onOpenDrawerTab
}: ProjectNetworkGraphAppContextMenuProps) {
    const deploymentStatus = usePodsStatus(
        (state) => state.podsStatus.get(app.id)?.deploymentStatus ?? 'UNKNOWN',
    );
    const lifecycle = AppLifecycleUtils.availability(app, role, deploymentStatus);

    return (
        <ContextMenu>
            <ContextMenuTrigger>{children}</ContextMenuTrigger>
            <ContextMenuContent onClick={(event) => event.stopPropagation()}>
                {lifecycle.canManage && <>
                    <ContextMenuSub>
                        <ContextMenuSubTrigger className="gap-2">
                            <Rocket />
                            Deploy
                        </ContextMenuSubTrigger>
                        <ContextMenuSubContent onClick={(event) => event.stopPropagation()}>
                            <ContextMenuItem
                                disabled={!lifecycle.canDeploy}
                                onClick={() => void Toast.fromAction(() => deploy(app.id))}
                            >
                                <Rocket />
                                Deploy
                            </ContextMenuItem>
                            {lifecycle.supportsRebuild && <ContextMenuItem
                                    disabled={!lifecycle.canRebuild}
                                    onClick={() => void Toast.fromAction(() => deploy(app.id, true))}
                                >
                                    <Hammer />
                                    Rebuild
                                </ContextMenuItem>}
                            <ContextMenuItem
                                disabled={!lifecycle.canStart}
                                onClick={() => void Toast.fromAction(() => startApp(app.id))}
                            >
                                <Play />
                                Start
                            </ContextMenuItem>
                            <ContextMenuItem
                                disabled={!lifecycle.canStop}
                                onClick={() => void Toast.fromAction(() => stopApp(app.id))}
                            >
                                <Square />
                                Stop
                            </ContextMenuItem>
                        </ContextMenuSubContent>
                    </ContextMenuSub>
                    <ContextMenuSeparator />
                    <ContextMenuItem onClick={() => onOpenDrawerTab('deployments')}>
                        <Box />
                        View Deployments
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => onOpenDrawerTab('logs')}>
                        <Logs />
                        View Logs
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => onOpenDrawerTab('settings')}>
                        <Settings />
                        View Settings
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem onClick={onToggleInternetAccess}>
                        <Globe2 />
                        {allowInternetAccess ? 'Disable' : 'Enable'} Egress Internet Access
                    </ContextMenuItem>
                </>}
                {lifecycle.canManage && <ContextMenuItem variant="destructive" onClick={onDelete}>
                    <Trash2 />
                    Delete App
                </ContextMenuItem>}
            </ContextMenuContent>
        </ContextMenu>
    );
}
