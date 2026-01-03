'use server'

import { getAdminUserSession, getAuthUserSession } from "@/server/utils/action-wrapper.utils";
import PageTitle from "@/components/custom/page-title";
import paramService, { ParamService } from "@/server/services/param.service";
import QuickStackIngressSettings from "./qs-ingress-settings";
import QuickStackLetsEncryptSettings from "./qs-letsencrypt-settings";
import { Constants } from "@/shared/utils/constants";
import QuickStackRegistrySettings from "./qs-registry-settings";
import s3TargetService from "@/server/services/s3-target.service";
import QuickStackPublicIpSettings from "./qs-public-ip-settings";
import QuickStackSystemBackupSettings from "./qs-system-backup-settings";
import QuickStackTraefikSettings from "./qs-traefik-settings";
import BreadcrumbSetter from "@/components/breadcrumbs-setter";
import traefikService from "@/server/services/traefik.service";
import { Separator } from "@/components/ui/separator";
import { TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import QuickStackVersionInfo from "./qs-version-info";
import QuickStackMaintenanceSettings from "./qs-maintenance-settings";
import podService from "@/server/services/pod.service";
import quickStackService from "@/server/services/qs.service";
import { ServerSettingsTabs } from "./server-settings-tabs";
import { Settings, Network, HardDrive, Rocket, Wrench } from "lucide-react";
import quickStackUpdateService from "@/server/services/qs-update.service";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import clusterService from "@/server/services/cluster.service";
import NodeInfo from "./nodeInfo";
import K3sUpdateInfo from "./k3s-update-info";
import UpdateInfoPage from "./update-info";

export default async function ProjectPage({
    searchParams
}: {
    searchParams: { [key: string]: string | string[] | undefined }
}) {

    const session = await getAdminUserSession();

    const [
        serverUrl,
        disableNodePortAccess,
        letsEncryptMail,
        regitryStorageLocation,
        ipv4Address,
        systemBackupLocation,
        clusterJoinToken
    ] = await Promise.all([
        paramService.getString(ParamService.QS_SERVER_HOSTNAME, ''),
        paramService.getBoolean(ParamService.DISABLE_NODEPORT_ACCESS, false),
        paramService.getString(ParamService.LETS_ENCRYPT_MAIL, session.email),
        paramService.getString(ParamService.REGISTRY_SOTRAGE_LOCATION, Constants.INTERNAL_REGISTRY_LOCATION),
        paramService.getString(ParamService.PUBLIC_IPV4_ADDRESS),
        paramService.getString(ParamService.QS_SYSTEM_BACKUP_LOCATION, Constants.QS_SYSTEM_BACKUP_DEACTIVATED),
        paramService.getString(ParamService.K3S_JOIN_TOKEN)
    ]);

    const [
        s3Targets,
        traefikStatus,
        qsPodInfos,
        newVersionInfo,
        nodeInfo
    ] = await Promise.all([
        s3TargetService.getAll(),
        traefikService.getStatus(),
        podService.getPodsForApp(Constants.QS_NAMESPACE, Constants.QS_APP_NAME),
        quickStackUpdateService.getNewVersionInfo(),
        clusterService.getNodeInfo()
    ]);

    const qsPodInfo = qsPodInfos.find(p => !!p);
    const defaultTab = typeof searchParams?.tab === 'string' ? searchParams.tab : 'general';

    return (
        <div className="flex-1 space-y-6 pt-6  pb-16">
            <div className="space-y-0.5">
                <PageTitle
                    title={'QuickStack Settings'}
                    subtitle={`View or edit Server Settings`}>
                </PageTitle>
            </div>
            <BreadcrumbSetter items={[
                { name: "Settings", url: "/settings/profile" },
                { name: "QuickStack Server" },
            ]} />

            <Separator className="my-6" />

            <ServerSettingsTabs defaultTab={defaultTab}>
                <ScrollArea>
                    <TabsList>
                        <TabsTrigger value="general"><Settings className="mr-2 h-4 w-4" />General</TabsTrigger>
                        <TabsTrigger value="networking"><Network className="mr-2 h-4 w-4" />Networking / Traefik</TabsTrigger>
                        <TabsTrigger value="storage"><HardDrive className="mr-2 h-4 w-4" />Storage & Backups</TabsTrigger>
                        <TabsTrigger value="cluster"><Network className="mr-2 h-4 w-4" />Cluster</TabsTrigger>
                        <TabsTrigger value="updates"><Rocket className="mr-2 h-4 w-4" />Updates {newVersionInfo && <div className="h-2 w-2 ml-2 rounded-full bg-orange-500 animate-pulse" />}</TabsTrigger>
                        <TabsTrigger value="maintenance"><Wrench className="mr-2 h-4 w-4" />Maintenance</TabsTrigger>
                    </TabsList>
                    <ScrollBar orientation="horizontal" />
                </ScrollArea>
                <TabsContent value="general" className="space-y-4">
                    <div className="grid gap-6">
                        <QuickStackIngressSettings disableNodePortAccess={disableNodePortAccess!} serverUrl={serverUrl!} />
                        <QuickStackPublicIpSettings publicIpv4={ipv4Address} />
                    </div>
                </TabsContent>

                <TabsContent value="networking" className="space-y-4">
                    <div className="grid gap-6">
                        <QuickStackLetsEncryptSettings letsEncryptMail={letsEncryptMail!} />
                        <QuickStackTraefikSettings initialStatus={traefikStatus} />
                    </div>
                </TabsContent>

                <TabsContent value="storage" className="space-y-4">
                    <div className="grid gap-6">
                        <QuickStackRegistrySettings registryStorageLocation={regitryStorageLocation!} s3Targets={s3Targets} />
                        <QuickStackSystemBackupSettings systemBackupLocation={systemBackupLocation!} s3Targets={s3Targets} />
                    </div>
                </TabsContent>

                <TabsContent value="cluster" className="space-y-4">
                    <NodeInfo nodeInfos={nodeInfo} clusterJoinToken={clusterJoinToken} />
                </TabsContent>
                <TabsContent value="updates" className="space-y-4">
                    <UpdateInfoPage />
                </TabsContent>
                <TabsContent value="maintenance" className="space-y-4">
                    <div className="grid gap-6">
                        <QuickStackMaintenanceSettings qsPodName={qsPodInfo?.podName} />
                    </div>
                </TabsContent>
            </ServerSettingsTabs>
        </div>
    )
}
