'use client';

import { type Ref } from 'react';

import { BarChart3, Bot, Boxes, Key, Rocket, Logs as LogsIcon, Pencil, Settings, X, RotateCwClock } from 'lucide-react';
import { Button } from '@/components/ui/button';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { cn } from '@/frontend/utils/utils';
import { AppSourceUtils } from '@/frontend/utils/app-source.utils';
import type { AppExtendedModel } from '@/shared/model/app-extended.model';
import Logs from '@/app/project/[projectId]/apps/details/runtime/logs';
import MonitoringTab from '@/app/project/[projectId]/apps/details/runtime/monitoring-app';
import { RolePermissionEnum } from '@/shared/model/role-extended.model';
import GeneralAppSource from '@/app/project/[projectId]/apps/details/source/app-source';
import DbCredentials from '@/app/project/[projectId]/apps/details/credentials/db-credentials';
import DbToolsCard from '@/app/project/[projectId]/apps/details/credentials/db-tools';
import { DrawerSettings } from './app-details-settings';
import { NestedDrawerProvider } from '../../../workload-components/drawer/nested-drawer';
import { AppDrawerAppContext } from './app-drawer-app-context';
import { DrawerBackupsTab } from './volumes/backups/app-details-backups-tab';
import { EditAppDialog } from '@/app/project/[projectId]/apps/create/edit-app-dialog';
import type { S3Target } from '@prisma/client';
import type { VolumeBackupExtendedModel } from '@/shared/model/volume-backup-extended.model';
import { AppDrawerNavigationUtils, type AppDrawerTab } from '@/shared/utils/app-drawer-navigation.utils';
import DrawerDeploymentsTab from './deployments/app-details-deployments-tab';

export type AppDetailsDrawerNode = { id: string; kind: string; external?: boolean; name: string; caption?: string };

import { DrawerTabScrollArea } from '@/app/project/workload-components/drawer/drawer-tab-scroll-area';
import { AppStatusActions } from './app-status-actions';

export function AppDetailsDrawer({
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
  openEnvironment,
  onEnvironmentOpened
}: {
  contentRef?: Ref<HTMLDivElement>;
  node: AppDetailsDrawerNode;
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
  onTabChange: (tab: AppDrawerTab) => void;
  openEnvironment?: boolean;
  onEnvironmentOpened?: () => void;
}) {
  const isApp = node.kind === 'APP';
  const isExternalApp = isApp && node.external;
  const needsSourceConfiguration = app && role === RolePermissionEnum.READWRITE && !AppSourceUtils.isConfiguredSource(app);
  const hasVolumes = (app?.appVolumes.length ?? 0) > 0;

  const activeTab = AppDrawerNavigationUtils.resolveTab(app?.appType, requestedTab, hasVolumes);

  const handleTabChange = (tab: string) => {
    const nextTab = AppDrawerNavigationUtils.resolveTab(app?.appType, tab, hasVolumes);
    onTabChange(nextTab);
  };

  return (
    <Drawer swipeDirection="right" disablePointerDismissal modal={false} open={open} onOpenChange={onOpenChange} onOpenChangeComplete={onOpenChangeComplete}>
      <DrawerContent ref={contentRef} className="min-w-0 border border-border/60 shadow data-[swipe-axis=x]:w-[calc(100%-1rem)] sm:data-[swipe-axis=x]:w-1/2">
        <AppDrawerAppContext.Provider value={app}>
          <NestedDrawerProvider>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 z-10 size-8 opacity-70 hover:opacity-100"
              onClick={() => onOpenChange(false)}
            >
              <X className="size-4" />
              <span className="sr-only">Close</span>
            </Button>
            <Tabs value={activeTab} onValueChange={handleTabChange} className="@container/drawer min-h-0 min-w-0 flex-1">
              <DrawerHeader className="gap-4 p-6 pr-12 pb-0 text-left">
                <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-3 @min-[40rem]/drawer:grid-cols-[auto_minmax(0,1fr)_auto]">
                  <div
                    className={cn(
                      'flex size-12 shrink-0 items-center justify-center rounded-lg ring-1',
                      isApp ? 'bg-qs-500/10 text-qs-600 ring-qs-500/30' : 'bg-violet-500/15 text-violet-600 ring-violet-500/30'
                    )}
                  >
                    {isApp ? <Boxes className="size-6" /> : <Bot className="size-6" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <DrawerTitle className="group/title flex items-center gap-1 text-lg">
                      <span className="truncate">{node.name}</span>
                      {app && role === RolePermissionEnum.READWRITE && (
                        <EditAppDialog projectId={app.projectId} existingItem={app}>
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
                    <DrawerDescription className="text-xs wrap-anywhere">{node.caption ?? (isApp ? 'App' : 'Agent sandbox')}</DrawerDescription>
                  </div>
                  {app && !needsSourceConfiguration && (
                    <div className="col-span-2 min-w-0 @min-[40rem]/drawer:col-span-1">
                      <AppStatusActions app={app} role={role} />
                    </div>
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
              {isExternalApp ? (
                <Empty className="rounded-none border-0">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Settings />
                    </EmptyMedia>
                    <EmptyTitle>Settings unavailable</EmptyTitle>
                    <EmptyDescription>This app belongs to another project. Its settings can only be edited from that project.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : needsSourceConfiguration ? (
                <DrawerTabScrollArea>
                  <GeneralAppSource app={app} readonly={role !== RolePermissionEnum.READWRITE} />
                </DrawerTabScrollArea>
              ) : (
                app &&
                role && (
                  <>
                    <TabsContent value="deployments" className="flex min-h-0 min-w-0 flex-1 flex-col">
                      <DrawerTabScrollArea>
                        <DrawerDeploymentsTab key={app.id} app={app} role={role} />
                      </DrawerTabScrollArea>
                    </TabsContent>
                    <TabsContent value="logs" className="flex min-h-0 min-w-0 flex-1 flex-col px-6 pt-3 pb-4">
                      <Logs key={app.id} app={app} role={role} />
                    </TabsContent>
                    <TabsContent value="stats" className="flex min-h-0 min-w-0 flex-1 flex-col">
                      <ScrollArea className="min-h-0 min-w-0 flex-1 px-6 pt-2" contentClassName="flex min-h-full w-full min-w-0! max-w-full flex-col">
                        <MonitoringTab key={app.id} app={app} />
                      </ScrollArea>
                    </TabsContent>
                    {hasVolumes && (
                      <TabsContent value="backups" className="flex min-h-0 min-w-0 flex-1 flex-col">
                        <ScrollArea className="min-h-0 min-w-0 flex-1 px-6 pt-2" contentClassName="flex min-h-full w-full min-w-0! max-w-full flex-col">
                          <DrawerBackupsTab app={app} role={role} s3Targets={s3Targets} volumeBackups={volumeBackups} />
                        </ScrollArea>
                      </TabsContent>
                    )}
                    {app.appType !== 'APP' && (
                      <TabsContent value="credentials" className="flex min-h-0 min-w-0 flex-1 flex-col">
                        <DrawerTabScrollArea>
                          <div className="space-y-4 px-1 pt-1">
                            {role === RolePermissionEnum.READWRITE && <DbToolsCard app={app} />}
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
                            openEnvironment={openEnvironment}
                            onEnvironmentOpened={onEnvironmentOpened}
                          />
                        </div>
                      </DrawerTabScrollArea>
                    </TabsContent>
                  </>
                )
              )}
            </Tabs>
          </NestedDrawerProvider>
        </AppDrawerAppContext.Provider>
      </DrawerContent>
    </Drawer>
  );
}
