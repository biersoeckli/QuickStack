'use client';

import { type Ref } from 'react';
import {
    Bot,
    Hammer,
    Pencil,
    Settings,
    X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerHeader,
    DrawerTitle,
} from '@/components/ui/drawer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '@/components/ui/empty';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDialog } from '@/frontend/states/zustand.states';
import { DrawerTabScrollArea } from '@/app/project/[projectId]/app-components/app-drawer-components/app-details-drawer';
import { NestedDrawerProvider } from '@/app/project/[projectId]/app-components/app-drawer-components/nested-drawer';
import AgentSandboxesCard from './sandboxes/agent-sandboxes-card';
import WorkloadBuildsTable from '@/components/custom/workload-builds-table';
import { RenameAgentDialog } from '@/app/project/[projectId]/agent-components/rename-agent-dialog';
import { AgentSandboxStatusActions } from './agent-sandbox-status-actions';
import AgentSandboxDrawerSettings from './agent-sandbox-drawer-settings';
import type { AgentExtendedModel } from '@/shared/model/agent-extended.model';
import { RolePermissionEnum } from '@/shared/model/role-extended.model.ts';
import type { AgentSandboxTemplateInfo } from '@/shared/model/agent-sandbox-template-info.model';
import {
    AgentDrawerNavigationUtils,
    type AgentDrawerTab,
} from '@/shared/utils/agent-drawer-navigation.utils';
import { formatDateTime } from '@/frontend/utils/format.utils';

export function AgentSandboxDrawer({
    contentRef,
    agent,
    role,
    templateInfo,
    storageClasses,
    runtimeClasses,
    open,
    onOpenChange,
    onOpenChangeComplete,
    requestedTab,
    onTabChange,
}: {
    contentRef?: Ref<HTMLDivElement>;
    agent?: AgentExtendedModel;
    role?: RolePermissionEnum;
    templateInfo?: AgentSandboxTemplateInfo;
    storageClasses: string[];
    runtimeClasses: string[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onOpenChangeComplete: (open: boolean) => void;
    requestedTab?: string | null;
    onTabChange: (tab: AgentDrawerTab) => void;
}) {
    const { openDialog } = useDialog();
    const readonly = role !== RolePermissionEnum.READWRITE;
    const hasGitSource = agent?.sourceType === 'GIT' || agent?.sourceType === 'GIT_SSH';
    const activeTab = AgentDrawerNavigationUtils.resolveTab(requestedTab, { readonly, hasGitSource: !!hasGitSource });

    const handleTabChange = (tab: string) => {
        onTabChange(AgentDrawerNavigationUtils.resolveTab(tab, { readonly, hasGitSource: !!hasGitSource }));
    };

    const openRenameDialog = () => {
        if (!agent) return;
        openDialog(<RenameAgentDialog agent={agent} />, { maxWidth: 'max-w-md' });
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
                                <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-600 ring-1 ring-violet-500/30">
                                    <Bot className="size-6" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <DrawerTitle className="group/title flex items-center gap-1 text-lg">
                                        <span className="truncate">{agent?.name ?? 'Agent Sandbox'}</span>
                                        {agent && role === RolePermissionEnum.READWRITE && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon-sm"
                                                className="shrink-0 opacity-0 transition-opacity group-hover/title:opacity-100 focus-visible:opacity-100"
                                                onClick={openRenameDialog}
                                            >
                                                <Pencil />
                                                <span className="sr-only">Rename Agent Sandbox</span>
                                            </Button>
                                        )}
                                    </DrawerTitle>
                                    <DrawerDescription className="text-xs">
                                        Agent Sandbox{agent ? ` · ${agent.project.name}` : ''}
                                        {templateInfo?.lastDeployedAt
                                            ? ` · Last deployed ${formatDateTime(templateInfo.lastDeployedAt)}`
                                            : ''}
                                    </DrawerDescription>
                                </div>
                                {agent && (
                                    <AgentSandboxStatusActions
                                        agent={agent}
                                        readonly={readonly}
                                        onDeleted={() => onOpenChange(false)}
                                    />
                                )}
                            </div>
                            {agent && role ? (
                                <ScrollArea scrollbarOrientation="horizontal">
                                    <TabsList className="mt-4 gap-4">
                                        <TabsTrigger value="sandboxes">
                                            <Bot />
                                            Sandboxes
                                        </TabsTrigger>
                                        {!readonly && hasGitSource && (
                                            <TabsTrigger value="builds">
                                                <Hammer />
                                                Builds
                                            </TabsTrigger>
                                        )}
                                        {!readonly && (
                                            <TabsTrigger value="configuration">
                                                <Settings />
                                                Configuration
                                            </TabsTrigger>
                                        )}
                                    </TabsList>
                                </ScrollArea>
                            ) : (
                                <div className="h-2"></div>
                            )}
                        </DrawerHeader>
                        {agent && role ? (
                            <>
                                <TabsContent value="sandboxes" className="flex min-h-0 min-w-0 flex-1 flex-col">
                                    <DrawerTabScrollArea>
                                        <AgentSandboxesCard
                                            agentId={agent.id}
                                            readonly={readonly}
                                            namespace={agent.projectId}
                                            agentDomains={agent.agentDomains}
                                        />
                                    </DrawerTabScrollArea>
                                </TabsContent>
                                {!readonly && hasGitSource && (
                                    <TabsContent value="builds" className="flex min-h-0 min-w-0 flex-1 flex-col">
                                        <DrawerTabScrollArea>
                                            <WorkloadBuildsTable
                                                workloadId={agent.id}
                                                workloadType="agent"
                                                card
                                                title="Builds"
                                                description="Overview of build jobs for this Agent Sandbox."
                                                hideSearchBar
                                            />
                                        </DrawerTabScrollArea>
                                    </TabsContent>
                                )}
                                {!readonly && (
                                    <TabsContent value="configuration" className="flex min-h-0 min-w-0 flex-1 flex-col">
                                        <DrawerTabScrollArea>
                                            <AgentSandboxDrawerSettings
                                                agent={agent}
                                                readonly={readonly}
                                                storageClasses={storageClasses}
                                                runtimeClasses={runtimeClasses}
                                            />
                                        </DrawerTabScrollArea>
                                    </TabsContent>
                                )}
                            </>
                        ) : (
                            <Empty className="border-0 rounded-none">
                                <EmptyHeader>
                                    <EmptyMedia variant="icon">
                                        <Bot />
                                    </EmptyMedia>
                                    <EmptyTitle>Agent Sandbox unavailable</EmptyTitle>
                                    <EmptyDescription>
                                        This Agent Sandbox could not be loaded. It may have been deleted.
                                    </EmptyDescription>
                                </EmptyHeader>
                            </Empty>
                        )}
                    </Tabs>
                </NestedDrawerProvider>
            </DrawerContent>
        </Drawer>
    );
}
