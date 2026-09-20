'use client';

import { type Ref } from 'react';

import {
    ArrowDown,
    ArrowUp,
    BarChart3,
    Bot,
    Boxes,
    ChevronDown,
    Copy,
    ExternalLink,
    Globe2,
    Hammer,
    LayoutDashboard,
    Network,
    Play,
    Rocket,
    ScrollText,
    Settings,
    Square,
    X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemMedia,
    ItemTitle,
} from '@/components/ui/item';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
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
import { toast } from 'sonner';
import type { AppExtendedModel } from '@/shared/model/app-extended.model';
import Logs from '@/app/project/app/[appId]/overview/logs';
import BuildsTab from '@/app/project/app/[appId]/overview/deployments';
import MonitoringTab from '@/app/project/app/[appId]/overview/monitoring-app';
import { RolePermissionEnum } from '@/shared/model/role-extended.model.ts';
import type { NetworkGraphNode } from './project-network-graph-projection';
import GeneralAppSource from '@/app/project/app/[appId]/general/app-source';
import { DrawerOverview } from './drawer/drawer-overview';
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
        <div className="flex items-center rounded-md bg-emerald-500/10 px-2 py-1">

            {canManage ? (
                <DropdownMenu>
                    <DropdownMenuTrigger>
                        <div className="flex items-center gap-1">
                            <PodStatusIndicator appId={app.id} showLabel />
                            <Button
                                variant="ghost"
                                size="icon"
                                className="ml-1 size-5"
                            >
                                <ChevronDown className="size-3.5" />
                                <span className="sr-only">App actions</span>
                            </Button>
                        </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem
                            disabled={!appSourceIsConfigured}
                            onClick={() =>
                                void Toast.fromAction(() => deploy(app.id))
                            }
                        >
                            <Rocket />
                            Deploy
                        </DropdownMenuItem>
                        {app.appType === 'APP' &&
                            (app.sourceType === 'GIT' ||
                                app.sourceType === 'GIT_SSH') && (
                                <DropdownMenuItem
                                    disabled={!appSourceIsConfigured}
                                    onClick={() =>
                                        void Toast.fromAction(() =>
                                            deploy(app.id, true),
                                        )
                                    }
                                >
                                    <Hammer />
                                    Rebuild
                                </DropdownMenuItem>
                            )}
                        <DropdownMenuItem
                            disabled={!canStart || !appSourceIsConfigured}
                            onClick={() =>
                                void Toast.fromAction(() => startApp(app.id))
                            }
                        >
                            <Play />
                            Start
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            disabled={!canStop || !appSourceIsConfigured}
                            onClick={() =>
                                void Toast.fromAction(() => stopApp(app.id))
                            }
                        >
                            <Square />
                            Stop
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            ) : <PodStatusIndicator appId={app.id} showLabel />}
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
    onOpen,
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
    onOpen: () => void;
}) {
    const isApp = node.kind === 'APP';
    const needsSourceConfiguration =
        app &&
        role === RolePermissionEnum.READWRITE &&
        !AppSourceUtils.isConfiguredSource(app);

    const externalDomain = app?.appDomains[0];
    const externalUrl = externalDomain
        ? `${externalDomain.useSsl ? 'https' : 'http'}://${externalDomain.hostname}`
        : undefined;

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
                    <Tabs defaultValue="deployments" className="min-h-0 flex-1">
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
                                {app && !needsSourceConfiguration && (
                                    <AppStatusActions app={app} role={role} />
                                )}
                            </div>
                            {app && role && !needsSourceConfiguration ? (
                                <ScrollArea scrollbarOrientation="horizontal">
                                    <TabsList className="mt-4 gap-4">
                                        <TabsTrigger value="deployments">
                                            <Rocket />
                                            Deployments
                                        </TabsTrigger>
                                        <TabsTrigger value="logs">
                                            <ScrollText />
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
                        <ScrollArea className="min-h-0 flex-1 px-4">
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
                                        className="mt-4"
                                    >
                                        <BuildsTab
                                            key={app.id}
                                            app={app}
                                            role={role}
                                            view="grid"
                                        />
                                    </TabsContent>
                                    <TabsContent value="logs" className="mt-4">
                                        <Logs key={app.id} app={app} role={role} hideCard />
                                    </TabsContent>
                                    <TabsContent value="stats" className="mt-4">
                                        <MonitoringTab key={app.id} app={app} />
                                    </TabsContent>
                                    <TabsContent value="settings" className="mt-4">
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
