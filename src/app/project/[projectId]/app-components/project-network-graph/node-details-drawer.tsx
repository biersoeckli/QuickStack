'use client';

import { type Ref, useEffect, useState } from 'react';

import {
    BarChart3,
    Bot,
    Boxes,
    Hammer,
    Key,
    Play,
    Rocket,
    Logs as LogsIcon,
    Settings,
    Square,
    X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { Toast } from '@/frontend/utils/toast.utils';
import type { AppExtendedModel } from '@/shared/model/app-extended.model';
import Logs from '@/app/project/app/[appId]/overview/logs';
import BuildsTab from '@/app/project/app/[appId]/overview/deployments';
import MonitoringTab from '@/app/project/app/[appId]/overview/monitoring-app';
import { RolePermissionEnum } from '@/shared/model/role-extended.model.ts';
import type { NetworkGraphNode } from './project-network-graph-projection';
import GeneralAppSource from '@/app/project/app/[appId]/general/app-source';
import DbCredentials from '@/app/project/app/[appId]/credentials/db-crendentials';
import DbToolsCard from '@/app/project/app/[appId]/credentials/db-tools';
import { DrawerSettings } from './drawer/drawer-settings';
import { NestedDrawerProvider } from './drawer/nested-drawer';
import type { S3Target } from '@prisma/client';
import type { VolumeBackupExtendedModel } from '@/shared/model/volume-backup-extended.model';

export type PanelConnection = {
    id: string;
    name: string;
    direction: 'Ingress' | 'Egress';
    label?: string;
    copyValue?: string;
};

const drawerTabValues = ['deployments', 'credentials', 'logs', 'stats', 'settings'] as const;
type DrawerTab = (typeof drawerTabValues)[number];

function isDrawerTab(value: string | null | undefined): value is DrawerTab {
    return drawerTabValues.includes(value as DrawerTab);
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
    const canManage = role === RolePermissionEnum.READWRITE;
    const appSourceIsConfigured = AppSourceUtils.isConfiguredSource(app);
    const canStart = ['ERROR', 'UNKNOWN', 'SHUTDOWN', 'SHUTTING_DOWN'].includes(
        deploymentStatus,
    );
    const canStop = [
        'BUILDING',
        'DEPLOYED',
        'ERROR',
        'UNKNOWN',
        'DEPLOYING',
    ].includes(deploymentStatus);

    return (
        <div className="flex shrink-0 items-center gap-1">
            <PodStatusIndicator appId={app.id}  />
            {canManage ? (
                <TooltipProvider delay={300}>
                    <div className="ml-2 flex items-center gap-1 pl-2">
                        <Tooltip>
                            <TooltipTrigger
                                render={
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        disabled={!appSourceIsConfigured}
                                        onClick={() => void Toast.fromAction(() => deploy(app.id))}
                                    >
                                        <Rocket />
                                        <span className="sr-only">Deploy</span>
                                    </Button>
                                }
                            />
                            <TooltipContent>Deploy</TooltipContent>
                        </Tooltip>
                        {app.appType === 'APP' &&
                            (app.sourceType === 'GIT' || app.sourceType === 'GIT_SSH') && (
                                <Tooltip>
                                    <TooltipTrigger
                                        render={
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon-sm"
                                                disabled={!appSourceIsConfigured}
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
                                        disabled={!canStart || !appSourceIsConfigured}
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
                                        disabled={!canStop || !appSourceIsConfigured}
                                        onClick={() => void Toast.fromAction(() => stopApp(app.id))}
                                    >
                                        <Square />
                                        <span className="sr-only">Stop</span>
                                    </Button>
                                }
                            />
                            <TooltipContent>Stop</TooltipContent>
                        </Tooltip>
                    </div>
                </TooltipProvider>
            ) : null}
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

    const defaultTab: DrawerTab =
        app?.appType !== 'APP' && requestedTab === 'credentials'
            ? 'credentials'
            : isDrawerTab(requestedTab)
                ? requestedTab
                : 'deployments';
    const [activeTab, setActiveTab] = useState<DrawerTab>(defaultTab);

    useEffect(() => {
        setActiveTab(defaultTab);
    }, [app?.id, defaultTab]);

    const handleTabChange = (tab: string) => {
        if (!isDrawerTab(tab)) return;
        setActiveTab(tab);
        onTabChange(tab);
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
                className="border border-border/60 data-[swipe-axis=x]:w-full sm:data-[swipe-axis=x]:w-1/2 shadow"
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
                        className="min-h-0 flex-1"
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
                                    <DrawerTitle className="truncate text-lg">
                                        {node.name}
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
                        <ScrollArea className="min-h-0 flex-1 px-6 pt-2">
                            {needsSourceConfiguration ? (
                                <>
                                    <GeneralAppSource
                                        hideCard
                                        app={app}
                                        readonly={
                                            role !== RolePermissionEnum.READWRITE
                                        }
                                    />
                                </>
                            ) : app && role && (
                                <>
                                    <TabsContent
                                        value="deployments"
                                        className="mb-4"
                                    >
                                        <BuildsTab
                                            key={app.id}
                                            app={app}
                                            role={role}
                                            view="grid"
                                        />
                                    </TabsContent>
                                    <TabsContent value="logs" className="mb-4">
                                        <Logs key={app.id} app={app} role={role} hideCard />
                                    </TabsContent>
                                    <TabsContent value="stats" className="mb-4">
                                        <MonitoringTab hideCard key={app.id} app={app} />
                                    </TabsContent>
                                    {app.appType !== 'APP' && (
                                        <TabsContent
                                            value="credentials"
                                            className="mb-4 space-y-4 px-1 pt-1"
                                        >
                                            {role === RolePermissionEnum.READWRITE && (
                                                <DbToolsCard app={app} />
                                            )}
                                            <DbCredentials app={app} />
                                        </TabsContent>
                                    )}
                                    <TabsContent value="settings" className="mb-4 pt-4">
                                        <DrawerSettings
                                            app={app}
                                            role={role}
                                            s3Targets={s3Targets}
                                            storageClasses={storageClasses}
                                            volumeBackups={volumeBackups}
                                            gitSshPublicKey={gitSshPublicKey}
                                        />
                                    </TabsContent>
                                </>
                            )}
                        </ScrollArea>
                    </Tabs>
                </NestedDrawerProvider>
            </DrawerContent>
        </Drawer>
    );
}
