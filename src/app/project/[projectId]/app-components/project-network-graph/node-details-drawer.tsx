'use client';

import { type ReactNode, type Ref } from 'react';

import {
    BarChart3,
    Bot,
    Boxes,
    ExternalLink,
    Hammer,
    Key,
    Play,
    Rocket,
    Logs as LogsIcon,
    Pencil,
    Settings,
    Square,
    X,
    RotateCwClock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerHeader,
    DrawerTitle,
} from '@/components/ui/drawer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PodStatusIndicator from '@/components/custom/pod-status-indicator';
import { deploy, startApp, stopApp } from '@/app/project/app/[appId]/actions';
import { usePodsStatus } from '@/frontend/states/zustand.states';
import { cn } from '@/frontend/utils/utils';
import { AppSourceUtils } from '@/frontend/utils/app-source.utils';
import { AppLifecycleUtils } from '@/frontend/utils/app-lifecycle.utils';
import { Toast } from '@/frontend/utils/toast.utils';
import type { AppExtendedModel } from '@/shared/model/app-extended.model';
import Logs from '@/app/project/app/[appId]/overview/logs';
import MonitoringTab from '@/app/project/app/[appId]/overview/monitoring-app';
import { RolePermissionEnum } from '@/shared/model/role-extended.model.ts';
import type { NetworkGraphNode } from './project-network-graph-projection';
import GeneralAppSource from '@/app/project/app/[appId]/general/app-source';
import DbCredentials from '@/app/project/app/[appId]/credentials/db-crendentials';
import DbToolsCard from '@/app/project/app/[appId]/credentials/db-tools';
import { DrawerSettings } from './drawer/drawer-settings';
import { NestedDrawerProvider } from './drawer/nested-drawer';
import { DrawerBackupsTab } from './drawer/drawer-backups-tab';
import { EditAppDialog } from '../edit-app-dialog';
import type { S3Target } from '@prisma/client';
import type { VolumeBackupExtendedModel } from '@/shared/model/volume-backup-extended.model';
import {
    DrawerSessionUtils,
    type DrawerTab,
} from './project-network-graph-drawer-session';
import DrawerDeploymentsTab from './drawer/drawer-deployments-tab';

export type PanelConnection = {
    id: string;
    name: string;
    direction: 'Ingress' | 'Egress';
    label?: string;
    copyValue?: string;
};

function DrawerTabScrollArea({ children }: { children: ReactNode }) {
    return (
        <ScrollArea className="min-h-0 min-w-0 flex-1 px-6 pt-2">
            <div className="min-w-0 pb-4">{children}</div>
        </ScrollArea>
    );
}

function AppStatusActions({
    app,
    role,
}: {
    app: AppExtendedModel;
    role?: RolePermissionEnum;
}) {
    const deploymentStatus = usePodsStatus(
        (state) => state.podsStatus.get(app.id)?.deploymentStatus ?? 'UNKNOWN',
    );
    const lifecycle = AppLifecycleUtils.availability(app, role, deploymentStatus);
    const openDomain = (domain: AppExtendedModel['appDomains'][number]) => {
        const protocol = domain.useSsl ? 'https' : 'http';

        window.open(`${protocol}://${domain.hostname}`, '_blank');
    };

    return (
        <div className="flex shrink-0 items-center gap-1 bg-stone-100 rounded-2xl pl-4 pr-2 py-1">
            <PodStatusIndicator appId={app.id} />
            {(lifecycle.canManage || app.appDomains.length > 0) && (
                <TooltipProvider delay={300}>
                    <div className="ml-2 flex items-center gap-1 pl-2">
                        {lifecycle.canManage && (
                            <>
                                <Tooltip>
                                    <TooltipTrigger
                                        render={
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon-sm"
                                                disabled={!lifecycle.canDeploy}
                                                onClick={() => void Toast.fromAction(() => deploy(app.id))}
                                            >
                                                <Rocket />
                                                <span className="sr-only">Deploy</span>
                                            </Button>
                                        }
                                    />
                                    <TooltipContent>Deploy</TooltipContent>
                                </Tooltip>
                                {lifecycle.supportsRebuild && (
                                    <Tooltip>
                                        <TooltipTrigger
                                            render={
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    disabled={!lifecycle.canRebuild}
                                                    onClick={() => void Toast.fromAction(() => deploy(app.id, true))}
                                                >
                                                    <Hammer />
                                                    <span className="sr-only">Rebuild</span>
                                                </Button>
                                            }
                                        />
                                        <TooltipContent>Rebuild</TooltipContent>
                                    </Tooltip>
                                )}
                                <Tooltip>
                                    <TooltipTrigger
                                        render={
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon-sm"
                                                disabled={!lifecycle.canStart}
                                                onClick={() => void Toast.fromAction(() => startApp(app.id))}
                                            >
                                                <Play />
                                                <span className="sr-only">Start</span>
                                            </Button>
                                        }
                                    />
                                    <TooltipContent>Start</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger
                                        render={
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon-sm"
                                                className="hover:bg-destructive/10 hover:text-destructive"
                                                disabled={!lifecycle.canStop}
                                                onClick={() => void Toast.fromAction(() => stopApp(app.id))}
                                            >
                                                <Square />
                                                <span className="sr-only">Stop</span>
                                            </Button>
                                        }
                                    />
                                    <TooltipContent>Stop</TooltipContent>
                                </Tooltip>
                            </>
                        )}
                        {app.appDomains.length === 1 && (
                            <Tooltip>
                                <TooltipTrigger
                                    render={
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon-sm"
                                            onClick={() => openDomain(app.appDomains[0])}
                                        >
                                            <ExternalLink />
                                            <span className="sr-only">Open domain</span>
                                        </Button>
                                    }
                                />
                                <TooltipContent>Open domain</TooltipContent>
                            </Tooltip>
                        )}
                        {app.appDomains.length > 1 && (
                            <DropdownMenu>
                                <DropdownMenuTrigger
                                    render={
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon-sm"
                                            aria-label="Open domain"
                                            title="Open domain"
                                        >
                                            <ExternalLink />
                                        </Button>
                                    }
                                />
                                <DropdownMenuContent align="end" className="w-fit">
                                    {app.appDomains.map((domain) => (
                                        <DropdownMenuItem
                                            key={domain.id}
                                            onClick={() => openDomain(domain)}
                                        >
                                            <ExternalLink />
                                            {domain.hostname}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </div>
                </TooltipProvider>
            )}
        </div>
    );
}

export function NodeDetailsDrawer({
    contentRef,
    node,
    app,
    role,
    s3Targets,
    storageClasses,
    volumeBackups,
    gitSshPublicKey,
    open,
    onOpenChange,
    onOpenChangeComplete,
    requestedTab,
    onTabChange,
}: {
    contentRef?: Ref<HTMLDivElement>;
    node: NetworkGraphNode;
    app?: AppExtendedModel;
    role?: RolePermissionEnum;
    s3Targets: S3Target[];
    storageClasses: string[];
    volumeBackups: VolumeBackupExtendedModel[];
    gitSshPublicKey?: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onOpenChangeComplete: (open: boolean) => void;
    requestedTab?: string | null;
    onTabChange: (tab: DrawerTab) => void;
}) {
    const isApp = node.kind === 'APP';
    const needsSourceConfiguration =
        app &&
        role === RolePermissionEnum.READWRITE &&
        !AppSourceUtils.isConfiguredSource(app);
    const hasVolumes = (app?.appVolumes.length ?? 0) > 0;

    const activeTab = DrawerSessionUtils.resolveTab(
        app?.appType,
        requestedTab,
        hasVolumes,
    );

    const handleTabChange = (tab: string) => {
        const nextTab = DrawerSessionUtils.resolveTab(app?.appType, tab, hasVolumes);
        onTabChange(nextTab);
    };

    return (
        <Drawer
            swipeDirection="right"
            disablePointerDismissal
            modal={false}
            open={open}
            onOpenChange={onOpenChange}
            onOpenChangeComplete={onOpenChangeComplete}
        >
            <DrawerContent
                ref={contentRef}
                className="min-w-0 border border-border/60 data-[swipe-axis=x]:w-[calc(100%-1rem)] sm:data-[swipe-axis=x]:w-1/2 shadow"
            >
                <NestedDrawerProvider>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-4 top-4 z-10 size-8 opacity-70 hover:opacity-100"
                        onClick={() => onOpenChange(false)}
                    >
                        <X className="size-4" />
                        <span className="sr-only">Close</span>
                    </Button>
                    <Tabs
                        value={activeTab}
                        onValueChange={handleTabChange}
                        className="min-h-0 min-w-0 flex-1"
                    >
                        <DrawerHeader className="gap-4 p-6 pb-0 pr-12 text-left">
                            <div className="flex items-start gap-3">
                                <div
                                    className={cn(
                                        'flex size-12 shrink-0 items-center justify-center rounded-lg ring-1',
                                        isApp
                                            ? 'bg-qs-500/10 text-qs-600 ring-qs-500/30'
                                            : 'bg-violet-500/15 text-violet-600 ring-violet-500/30',
                                    )}
                                >
                                    {isApp ? (
                                        <Boxes className="size-6" />
                                    ) : (
                                        <Bot className="size-6" />
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <DrawerTitle className="group/title flex items-center gap-1 text-lg">
                                        <span className="truncate">{node.name}</span>
                                        {app && role === RolePermissionEnum.READWRITE && (
                                            <EditAppDialog
                                                projectId={app.projectId}
                                                existingItem={app}
                                            >
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    className="shrink-0 opacity-0 transition-opacity group-hover/title:opacity-100 focus-visible:opacity-100"
                                                >
                                                    <Pencil />
                                                    <span className="sr-only">Edit app name</span>
                                                </Button>
                                            </EditAppDialog>
                                        )}
                                    </DrawerTitle>
                                    <DrawerDescription className="text-xs">
                                        {node.caption ??
                                            (isApp ? 'App' : 'Agent sandbox')}
                                    </DrawerDescription>
                                </div>
                                {app && !needsSourceConfiguration && (<>
                                    <AppStatusActions app={app} role={role} />
                                    <div className=""></div>
                                </>
                                )}
                            </div>
                            {app && role && !needsSourceConfiguration ? (
                                <ScrollArea scrollbarOrientation="horizontal">
                                    <TabsList className="mt-4 gap-4">
                                        <TabsTrigger value="deployments">
                                            <Rocket />
                                            Deployments
                                        </TabsTrigger>
                                        {app.appType !== 'APP' && (
                                            <TabsTrigger value="credentials">
                                                <Key />
                                                DB Access
                                            </TabsTrigger>
                                        )}
                                        <TabsTrigger value="logs">
                                            <LogsIcon />
                                            Logs
                                        </TabsTrigger>
                                        <TabsTrigger value="stats">
                                            <BarChart3 />
                                            Stats
                                        </TabsTrigger>
                                        {hasVolumes && (
                                            <TabsTrigger value="backups">
                                                <RotateCwClock />
                                                Backups
                                            </TabsTrigger>
                                        )}
                                        <TabsTrigger value="settings">
                                            <Settings />
                                            Settings
                                        </TabsTrigger>
                                    </TabsList>
                                </ScrollArea>
                            ) : (
                                <div className="h-2"></div>
                            )}
                        </DrawerHeader>
                        {needsSourceConfiguration ? (
                            <DrawerTabScrollArea>
                                <GeneralAppSource
                                    hideCard
                                    app={app}
                                    readonly={role !== RolePermissionEnum.READWRITE}
                                />
                            </DrawerTabScrollArea>
                        ) : app && role && (
                            <>
                                <TabsContent value="deployments" className="flex min-h-0 min-w-0 flex-1 flex-col">
                                    <DrawerTabScrollArea>
                                        <DrawerDeploymentsTab key={app.id} app={app} role={role} />
                                    </DrawerTabScrollArea>
                                </TabsContent>
                                <TabsContent value="logs" className="flex min-h-0 min-w-0 flex-1 flex-col px-6 pt-3 pb-4">
                                    <Logs key={app.id} app={app} role={role} hideCard useFullHeight />
                                </TabsContent>
                                <TabsContent value="stats" className="flex min-h-0 min-w-0 flex-1 flex-col">
                                    <DrawerTabScrollArea>
                                        <MonitoringTab hideCard key={app.id} app={app} />
                                    </DrawerTabScrollArea>
                                </TabsContent>
                                {hasVolumes && (
                                    <TabsContent value="backups" className="flex min-h-0 min-w-0 flex-1 flex-col">
                                        <DrawerTabScrollArea>
                                            <div className="px-2 pt-4">
                                                <DrawerBackupsTab
                                                    app={app}
                                                    role={role}
                                                    s3Targets={s3Targets}
                                                    volumeBackups={volumeBackups}
                                                />
                                            </div>
                                        </DrawerTabScrollArea>
                                    </TabsContent>
                                )}
                                {app.appType !== 'APP' && (
                                    <TabsContent value="credentials" className="flex min-h-0 min-w-0 flex-1 flex-col">
                                        <DrawerTabScrollArea>
                                            <div className="space-y-4 px-1 pt-1">
                                                {role === RolePermissionEnum.READWRITE && (
                                                    <DbToolsCard app={app} />
                                                )}
                                                <DbCredentials app={app} />
                                            </div>
                                        </DrawerTabScrollArea>
                                    </TabsContent>
                                )}
                                <TabsContent value="settings" className="flex min-h-0 min-w-0 flex-1 flex-col">
                                    <DrawerTabScrollArea>
                                        <div className="pt-4">
                                            <DrawerSettings
                                                app={app}
                                                role={role}
                                                storageClasses={storageClasses}
                                                gitSshPublicKey={gitSshPublicKey}
                                            />
                                        </div>
                                    </DrawerTabScrollArea>
                                </TabsContent>
                            </>
                        )}
                    </Tabs>
                </NestedDrawerProvider>
            </DrawerContent>
        </Drawer>
    );
}
