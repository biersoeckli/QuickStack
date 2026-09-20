'use client';

import type { ReactNode } from 'react';
import { Box, Edit2, Globe2, Hammer, Logs, Play, Rocket, Settings, Square, Trash2 } from 'lucide-react';
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
import { EditAppDialog } from '../edit-app-dialog';
import { usePodsStatus } from '@/frontend/states/zustand.states';
import { AppSourceUtils } from '@/frontend/utils/app-source.utils';
import { Toast } from '@/frontend/utils/toast.utils';
import type { AppExtendedModel } from '@/shared/model/app-extended.model';
import { RolePermissionEnum } from '@/shared/model/role-extended.model.ts';

export type ProjectNetworkGraphAppContextMenuProps = {
    app: AppExtendedModel;
    projectId: string;
    role?: RolePermissionEnum;
    allowInternetAccess: boolean;
    onToggleInternetAccess: () => void;
    onOpenDrawerTab: (tab: 'deployments' | 'logs' | 'settings') => void;
    onDelete: () => void;
    children: ReactNode;
};

export function ProjectNetworkGraphAppContextMenu({
    app,
    projectId,
    role,
    allowInternetAccess,
    onToggleInternetAccess,
    onDelete,
    children,
    onOpenDrawerTab
}: ProjectNetworkGraphAppContextMenuProps) {
    const canWrite = role === RolePermissionEnum.READWRITE;
    const deploymentStatus = usePodsStatus(
        (state) => state.podsStatus.get(app.id)?.deploymentStatus ?? 'UNKNOWN',
    );
    const appSourceIsConfigured = AppSourceUtils.isConfiguredSource(app);
    const canStart = ['ERROR', 'UNKNOWN', 'SHUTDOWN', 'SHUTTING_DOWN'].includes(
        deploymentStatus,
    );
    const canStop = ['BUILDING', 'DEPLOYED', 'ERROR', 'UNKNOWN', 'DEPLOYING'].includes(
        deploymentStatus,
    );

    return (
        <ContextMenu>
            <ContextMenuTrigger>{children}</ContextMenuTrigger>
            <ContextMenuContent onClick={(event) => event.stopPropagation()}>
                {canWrite && <>
                    <ContextMenuSub>
                        <ContextMenuSubTrigger className="gap-2">
                            <Rocket />
                            Deploy
                        </ContextMenuSubTrigger>
                        <ContextMenuSubContent onClick={(event) => event.stopPropagation()}>
                            <ContextMenuItem
                                disabled={!appSourceIsConfigured}
                                onClick={() => void Toast.fromAction(() => deploy(app.id))}
                            >
                                <Rocket />
                                Deploy
                            </ContextMenuItem>
                            {app.appType === 'APP'
                                && (app.sourceType === 'GIT' || app.sourceType === 'GIT_SSH') && <ContextMenuItem
                                    disabled={!appSourceIsConfigured}
                                    onClick={() => void Toast.fromAction(() => deploy(app.id, true))}
                                >
                                    <Hammer />
                                    Rebuild
                                </ContextMenuItem>}
                            <ContextMenuItem
                                disabled={!canStart || !appSourceIsConfigured}
                                onClick={() => void Toast.fromAction(() => startApp(app.id))}
                            >
                                <Play />
                                Start
                            </ContextMenuItem>
                            <ContextMenuItem
                                disabled={!canStop || !appSourceIsConfigured}
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
                {canWrite && <EditAppDialog projectId={projectId} existingItem={app}>
                    <ContextMenuItem>
                        <Edit2 />
                        Edit App Name
                    </ContextMenuItem>
                </EditAppDialog>}
                {canWrite && <ContextMenuItem variant="destructive" onClick={onDelete}>
                    <Trash2 />
                    Delete App
                </ContextMenuItem>}
            </ContextMenuContent>
        </ContextMenu>
    );
}
