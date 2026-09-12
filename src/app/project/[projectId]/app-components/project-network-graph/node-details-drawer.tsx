'use client';

import type { Ref } from 'react';

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
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
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
                            onSelect={() =>
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
                                    onSelect={() =>
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
                            onSelect={() =>
                                void Toast.fromAction(() => startApp(app.id))
                            }
                        >
                            <Play />
                            Start
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            disabled={!canStop || !appSourceIsConfigured}
                            onSelect={() =>
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
    connections,
    open,
    onOpenChange,
    onOpen,
}: {
    contentRef?: Ref<HTMLDivElement>;
    node: NetworkGraphNode;
    app?: AppExtendedModel;
    role?: RolePermissionEnum;
    connections: PanelConnection[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onOpen: () => void;
}) {
    const isApp = node.kind === 'APP';
    const needsSourceConfiguration =
        app &&
        role === RolePermissionEnum.READWRITE &&
        !AppSourceUtils.isConfiguredSource(app);
    const connectionsContent = (
        <div className="space-y-2">
            {connections.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                    No active connections.
                </p>
            ) : (
                <ItemGroup>
                    {connections.map((connection) => {
                        const isInternet = connection.name === 'Internet';
                        const DirectionIcon = connection.direction === 'Ingress'
                            ? ArrowDown
                            : ArrowUp;

                        return (
                            <Item key={connection.id} variant="outline" size="sm">
                                <ItemMedia
                                    variant="icon"
                                    className={
                                        isInternet
                                            ? 'bg-violet-500/10 text-violet-600'
                                            : 'bg-qs-500/10 text-qs-600'
                                    }
                                >
                                    {isInternet ? (
                                        <Globe2 className="size-4" />
                                    ) : (
                                        <DirectionIcon className="size-4" />
                                    )}
                                </ItemMedia>
                                <ItemContent>
                                    <ItemTitle>{connection.name}</ItemTitle>
                                    <ItemDescription>
                                        {connection.direction}
                                        {connection.label
                                            ? ` · ${connection.label}`
                                            : ''}
                                    </ItemDescription>
                                </ItemContent>
                                {connection.copyValue && (
                                    <ItemActions>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="size-7"
                                            title="Copy internal hostname"
                                            onClick={() => {
                                                void navigator.clipboard.writeText(
                                                    connection.copyValue!,
                                                );
                                                toast.success(
                                                    'Copied internal hostname to clipboard',
                                                );
                                            }}
                                        >
                                            <Copy className="size-3.5" />
                                            <span className="sr-only">
                                                Copy internal hostname
                                            </span>
                                        </Button>
                                    </ItemActions>
                                )}
                            </Item>
                        );
                    })}
                </ItemGroup>
            )}
        </div>
    );
    const externalDomain = app?.appDomains[0];
    const externalUrl = externalDomain
        ? `${externalDomain.useSsl ? 'https' : 'http'}://${externalDomain.hostname}`
        : undefined;
    return (
        <Drawer
            direction="right"
            dismissible={false}
            modal={false}
            open={open}
            onOpenChange={onOpenChange}
        >
            <DrawerContent ref={contentRef} className="flex flex-col p-0 data-[vaul-drawer-direction=right]:w-[85vw] data-[vaul-drawer-direction=right]:sm:max-w-lg data-[vaul-drawer-direction=right]:lg:max-w-xl">
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
                    defaultValue="overview"
                    className="flex min-h-0 flex-1 flex-col pt-7"
                >
                    <DrawerHeader className="gap-4 border-b p-6 pb-0 pr-12 text-left">
                        <div className="flex items-start gap-3">
                            <div
                                className={cn(
                                    'flex size-10 shrink-0 items-center justify-center rounded-lg ring-1',
                                    isApp
                                        ? 'bg-qs-500/10 text-qs-600 ring-qs-500/30'
                                        : 'bg-violet-500/15 text-violet-600 ring-violet-500/30',
                                )}
                            >
                                {isApp ? (
                                    <Boxes className="size-5" />
                                ) : (
                                    <Bot className="size-5" />
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <DrawerTitle className="truncate text-base">
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
                            <ScrollArea className="w-full whitespace-nowrap">
                                <TabsList className="h-auto w-max min-w-full justify-start gap-1 rounded-none bg-transparent p-0">
                                    <TabsTrigger
                                        value="overview"
                                        className="shrink-0 flex-1 rounded-none border-b-2 border-transparent px-3 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                                    >
                                        <LayoutDashboard className="mr-1.5 size-3.5" />
                                        Overview
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="logs"
                                        className="shrink-0 flex-1 rounded-none border-b-2 border-transparent px-3 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                                    >
                                        <ScrollText className="mr-1.5 size-3.5" />
                                        Logs
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="deployments"
                                        className="shrink-0 flex-1 rounded-none border-b-2 border-transparent px-3 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                                    >
                                        <Rocket className="mr-1.5 size-3.5" />
                                        Deployments
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="stats"
                                        className="shrink-0 flex-1 rounded-none border-b-2 border-transparent px-3 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                                    >
                                        <BarChart3 className="mr-1.5 size-3.5" />
                                        Stats
                                    </TabsTrigger>
                                </TabsList>
                                <ScrollBar orientation="horizontal" />
                            </ScrollArea>
                        ) : (
                            <div className="h-2"></div>
                        )}
                    </DrawerHeader>
                    <div className="min-h-0 flex-1 overflow-y-auto px-4">
                        {needsSourceConfiguration ? (
                            <>
                                <GeneralAppSource
                                    app={app}
                                    readonly={
                                        role !== RolePermissionEnum.READWRITE
                                    }
                                />
                            </>
                        ) : app && role ? (
                            <>
                                <TabsContent
                                    value="overview"
                                    className="mt-4 space-y-6"
                                >
                                    <ItemGroup className="gap-0">
                                        <Item size="xs">
                                            <ItemContent>
                                                <ItemTitle className="font-normal text-muted-foreground">
                                                    Image
                                                </ItemTitle>
                                            </ItemContent>
                                            <ItemActions className="max-w-[65%] truncate">
                                                {app.sourceType === 'CONTAINER'
                                                    ? (app.containerImageSource ??
                                                        'Not configured')
                                                    : (app.gitUrl ??
                                                        'Not configured')}
                                            </ItemActions>
                                        </Item>
                                        <Item size="xs">
                                            <ItemContent>
                                                <ItemTitle className="font-normal text-muted-foreground">
                                                    Replicas
                                                </ItemTitle>
                                            </ItemContent>
                                            <ItemActions>
                                                {app.replicas}
                                            </ItemActions>
                                        </Item>
                                        <Item size="xs">
                                            <ItemContent>
                                                <ItemTitle className="font-normal text-muted-foreground">
                                                    Project
                                                </ItemTitle>
                                            </ItemContent>
                                            <ItemActions>
                                                {app.project.name}
                                            </ItemActions>
                                        </Item>
                                        {externalUrl && (
                                            <Item size="xs">
                                                <ItemContent>
                                                    <ItemTitle className="font-normal text-muted-foreground">
                                                        External URL
                                                    </ItemTitle>
                                                </ItemContent>
                                                <ItemActions className="max-w-[65%] truncate">
                                                    <a
                                                        href={externalUrl}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="flex items-center gap-1 truncate text-primary underline"
                                                    >
                                                        <span className="truncate">
                                                            {externalUrl}
                                                        </span>
                                                        <ExternalLink className="size-3 shrink-0" />
                                                    </a>
                                                </ItemActions>
                                            </Item>
                                        )}
                                    </ItemGroup>
                                    <Separator className="my-8" />
                                    <div className="space-y-3">
                                        <h3 className="text-sm font-semibold">
                                            Network Policies
                                        </h3>
                                        {connectionsContent}
                                    </div>
                                </TabsContent>
                                <TabsContent value="logs" className="mt-4">
                                    <Logs key={app.id} app={app} role={role} hideCard />
                                </TabsContent>
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
                                <TabsContent value="stats" className="mt-4">
                                    <MonitoringTab key={app.id} app={app} />
                                </TabsContent>
                            </>
                        ) : (
                            <div>
                                <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                                    <Network className="size-4" />
                                    Network Policies ({connections.length})
                                </div>
                                {connectionsContent}
                            </div>
                        )}
                    </div>
                </Tabs>
                {isApp && (
                    <DrawerFooter className="border-t p-4">
                        <Button
                            variant="secondary"
                            className="w-full"
                            onClick={onOpen}
                        >
                            Open App Settings<ExternalLink className="ml-2 size-4" />
                        </Button>
                    </DrawerFooter>
                )}
            </DrawerContent>
        </Drawer>
    );
}
