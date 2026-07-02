'use client'

import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import GeneralAppRateLimits from "./general/app-rate-limits";
import GeneralAppSource from "./general/app-source";
import GeneralAppContainerConfig from "./general/app-container-config";
import EnvEdit from "./environment/env-edit";
import { S3Target } from "@prisma/client";
import DomainsCard from "../../../../components/custom/domains-card";
import StorageList from "./volumes/storages";
import { AppExtendedModel } from "@/shared/model/app-extended.model";
import BuildsTab from "./overview/deployments";
import Logs from "./overview/logs";
import MonitoringTab from "./overview/monitoring-app";
import InternalHostnames from "./domains/ports-and-internal-hostnames";
import NodePortsCard from "./domains/node-ports";
import FileMountsCard from "@/components/custom/file-mounts-card";
import WebhookDeploymentInfo from "./overview/webhook-deployment";
import DbCredentials from "./credentials/db-crendentials";
import VolumeBackupList from "./volumes/volume-backup";
import { VolumeBackupExtendedModel } from "@/shared/model/volume-backup-extended.model";
import BasicAuth from "./advanced/basic-auth";
import NetworkPolicy from "./advanced/network-policy";
import HealthCheckSettings from "./advanced/health-check-settings";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import DbToolsCard from "./credentials/db-tools";
import { RolePermissionEnum } from "@/shared/model/role-extended.model.ts";
import { NodeInfoModel } from "@/shared/model/node-info.model";
import { Eye, Key, Settings, Zap, Globe, HardDrive, Cog } from "lucide-react";
import { AppSourceUtils } from "@/frontend/utils/app-source.utils";

export default function AppTabs({
    app,
    role,
    tabName,
    s3Targets,
    volumeBackups,
    nodesInfo,
    gitSshPublicKey,
}: {
    app: AppExtendedModel;
    role: RolePermissionEnum;
    tabName: string;
    s3Targets: S3Target[];
    volumeBackups: VolumeBackupExtendedModel[];
    nodesInfo: NodeInfoModel[];
    gitSshPublicKey?: string;
}) {
    const router = useRouter();
    const readonly = role !== RolePermissionEnum.READWRITE;
    const appSourceIsConfigured = AppSourceUtils.isConfiguredSource(app);
    const openTab = (tabName: string) => {
        router.push(`/project/app/${app.id}?tabName=${tabName}`);
    }

    if (!appSourceIsConfigured) {
        return (
            <GeneralAppSource readonly={readonly} app={app} gitSshPublicKey={gitSshPublicKey} />
        )
    }

    return (
        <Tabs defaultValue="general" value={tabName} onValueChange={(newTab) => openTab(newTab)} className="space-y-4">
            <ScrollArea>
                <TabsList>
                    <TabsTrigger value="overview"><Eye className="mr-2 h-4 w-4" />Overview</TabsTrigger>
                    {app.appType !== 'APP' && <TabsTrigger value="credentials"><Key className="mr-2 h-4 w-4" />Credentials</TabsTrigger>}
                    <TabsTrigger value="general"><Settings className="mr-2 h-4 w-4" />General</TabsTrigger>
                    <TabsTrigger value="environment"><Zap className="mr-2 h-4 w-4" />Environment</TabsTrigger>
                    <TabsTrigger value="domains"><Globe className="mr-2 h-4 w-4" />Domains</TabsTrigger>
                    <TabsTrigger value="storage"><HardDrive className="mr-2 h-4 w-4" />Storage</TabsTrigger>
                    <TabsTrigger value="advanced"><Cog className="mr-2 h-4 w-4" />Advanced</TabsTrigger>
                </TabsList>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
            <TabsContent value="overview" className="grid grid-cols-1 3xl:grid-cols-2 gap-4">
                <MonitoringTab app={app} />
                <Logs role={role} app={app} />
                <BuildsTab role={role} app={app} />
                <WebhookDeploymentInfo role={role} app={app} />
            </TabsContent>
            {app.appType !== 'APP' && <TabsContent value="credentials" className="space-y-4">
                {role === RolePermissionEnum.READWRITE && <DbToolsCard app={app} />}
                <DbCredentials app={app} />
            </TabsContent>}
            <TabsContent value="general" className="space-y-4">
                <GeneralAppSource readonly={readonly} app={app} gitSshPublicKey={gitSshPublicKey} />
                <GeneralAppRateLimits readonly={readonly} app={app} />
                <GeneralAppContainerConfig readonly={readonly} app={app} />
            </TabsContent>
            <TabsContent value="environment" className="space-y-4">
                <EnvEdit readonly={readonly} app={app} />
            </TabsContent>
            <TabsContent value="domains" className="space-y-4">
                <DomainsCard readonly={readonly} domains={app.appDomains} workloadId={app.id} workloadType={'app'} />
                <InternalHostnames readonly={readonly} app={app} />
                <NodePortsCard readonly={readonly} app={app} />
            </TabsContent>
            <TabsContent value="storage" className="space-y-4">
                <StorageList readonly={readonly} app={app} nodesInfo={nodesInfo} />
                <FileMountsCard readonly={readonly} fileMounts={app.appFileMounts} workloadId={app.id} workloadType={'app'} />
                <VolumeBackupList
                    readonly={readonly}
                    app={app}
                    s3Targets={s3Targets}
                    volumeBackups={volumeBackups} />
            </TabsContent>
            <TabsContent value="advanced" className="space-y-4">
                <BasicAuth readonly={readonly} app={app} />
                <NetworkPolicy readonly={readonly} app={app} />
                <HealthCheckSettings readonly={readonly} app={app} />
            </TabsContent>
        </Tabs>
    )
}
