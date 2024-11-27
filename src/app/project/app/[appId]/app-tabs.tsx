'use client'

import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import GeneralAppRateLimits from "./general/app-rate-limits";
import GeneralAppSource from "./general/app-source";
import EnvEdit from "./environment/env-edit";
import { App } from "@prisma/client";
import DomainsList from "./domains/domains";
import StorageList from "./storage/storages";
import { AppExtendedModel } from "@/shared/model/app-extended.model";
import { BuildJobModel } from "@/shared/model/build-job";
import BuildsTab from "./overview/deployments";
import Logs from "./overview/logs";
import MonitoringTab from "./overview/monitoring-app";
import InternalHostnames from "./domains/internal-hostnames";
import TerminalStreamed from "./overview/terminal-streamed";

export default function AppTabs({
    app,
    tabName
}: {
    app: AppExtendedModel;
    tabName: string;
}) {
    const router = useRouter();

    const openTab = (tabName: string) => {
        router.push(`/project/app/${app.id}?tabName=${tabName}`);
    }

    return (
        <Tabs defaultValue="general" value={tabName} onValueChange={(newTab) => openTab(newTab)} className="space-y-4">
            <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="environment">Environment</TabsTrigger>
                <TabsTrigger value="domains">Domains</TabsTrigger>
                <TabsTrigger value="storage">Storage</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="grid grid-cols-1 3xl:grid-cols-2 gap-4">
                <Logs app={app} />
                <BuildsTab app={app} />
                <MonitoringTab app={app} />
            </TabsContent>
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
            </TabsContent>
        </Tabs>
    )
}
