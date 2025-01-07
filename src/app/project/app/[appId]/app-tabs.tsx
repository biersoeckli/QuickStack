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
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

export default function AppTabs({
    app,
    tabName,
    s3Targets,
    volumeBackups
}: {
    app: AppExtendedModel;
    tabName: string;
    s3Targets: S3Target[],
    volumeBackups: VolumeBackupExtendedModel[]
}) {
    const router = useRouter();

    const openTab = (tabName: string) => {
        router.push(`/project/app/${app.id}?tabName=${tabName}`);
    }

    return (
        <Tabs defaultValue="general" value={tabName} onValueChange={(newTab) => openTab(newTab)} className="space-y-4">
            <ScrollArea >
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
                <Logs app={app} />
                <BuildsTab app={app} />
                <WebhookDeploymentInfo app={app} />
            </TabsContent>
            {app.appType !== 'APP' && <TabsContent value="credentials" className="space-y-4">
                <DbCredentials app={app} />
            </TabsContent>}
            <TabsContent value="general" className="space-y-4">
                <GeneralAppSource app={app} />
                <GeneralAppRateLimits app={app} />
            </TabsContent>
            <TabsContent value="environment" className="space-y-4">
                <EnvEdit app={app} />
            </TabsContent>
            <TabsContent value="domains" className="space-y-4">
                <DomainsList app={app} />
                <InternalHostnames app={app} />
            </TabsContent>
            <TabsContent value="storage" className="space-y-4">
                <StorageList app={app} />
                <FileMount app={app} />
                <VolumeBackupList
                    app={app}
                    s3Targets={s3Targets}
                    volumeBackups={volumeBackups} />
            </TabsContent>
            <TabsContent value="advanced" className="space-y-4">
                <BasicAuth app={app} />
            </TabsContent>
        </Tabs>
    )
}
