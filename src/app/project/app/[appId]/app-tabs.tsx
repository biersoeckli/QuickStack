'use client'

import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import GeneralAppRateLimits from "./general/app-rate-limits";
import GeneralAppSource from "./general/app-source";
import EnvEdit from "./environment/env-edit";
import { S3Target } from "@prisma/client";
import DomainsList from "./domains/domains";
import StorageList from "./volumes/storages";
import { AppExtendedModel } from "@/shared/model/app-extended.model";
import BuildsTab from "./overview/deployments";
import Logs from "./overview/logs";
import MonitoringTab from "./overview/monitoring-app";
import InternalHostnames from "./domains/ports-and-internal-hostnames";
import FileMount from "./volumes/file-mount";
import WebhookDeploymentInfo from "./overview/webhook-deployment";
import DbCredentials from "./credentials/db-crendentials";
import VolumeBackupList from "./volumes/volume-backup";
import { VolumeBackupExtendedModel } from "@/shared/model/volume-backup-extended.model";
import BasicAuth from "./advanced/basic-auth";
import NetworkPolicy from "./advanced/network-policy";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import DbToolsCard from "./credentials/db-tools";
import { RolePermissionEnum } from "@/shared/model/role-extended.model.ts";

export default function AppTabs({
    app,
    role,
    tabName,
    s3Targets,
    volumeBackups
}: {
    app: AppExtendedModel;
    role: RolePermissionEnum;
    tabName: string;
    s3Targets: S3Target[],
    volumeBackups: VolumeBackupExtendedModel[]
}) {
    const router = useRouter();
    const readonly = role !== RolePermissionEnum.READWRITE;
    const openTab = (tabName: string) => {
        router.push(`/project/app/${app.id}?tabName=${tabName}`);
    }

    return (
        <Tabs defaultValue="general" value={tabName} onValueChange={(newTab) => openTab(newTab)} className="space-y-4">
            <ScrollArea>
                <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    {app.appType !== 'APP' && <TabsTrigger value="credentials">Credentials</TabsTrigger>}
                    <TabsTrigger value="general">General</TabsTrigger>
                    <TabsTrigger value="environment">Environment</TabsTrigger>
                    <TabsTrigger value="domains">Domains</TabsTrigger>
                    <TabsTrigger value="storage">Storage</TabsTrigger>
                    <TabsTrigger value="advanced">Advanced</TabsTrigger>
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
                <GeneralAppSource readonly={readonly} app={app} />
                <GeneralAppRateLimits readonly={readonly} app={app} />
            </TabsContent>
            <TabsContent value="environment" className="space-y-4">
                <EnvEdit readonly={readonly} app={app} />
            </TabsContent>
            <TabsContent value="domains" className="space-y-4">
                <DomainsList readonly={readonly} app={app} />
                <InternalHostnames readonly={readonly} app={app} />
            </TabsContent>
            <TabsContent value="storage" className="space-y-4">
                <StorageList readonly={readonly} app={app} />
                <FileMount readonly={readonly} app={app} />
                <VolumeBackupList
                    readonly={readonly}
                    app={app}
                    s3Targets={s3Targets}
                    volumeBackups={volumeBackups} />
            </TabsContent>
            <TabsContent value="advanced" className="space-y-4">
                <BasicAuth readonly={readonly} app={app} />
                <NetworkPolicy readonly={readonly} app={app} />
            </TabsContent>
        </Tabs>
    )
}
