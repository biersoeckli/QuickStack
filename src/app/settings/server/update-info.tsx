'use server'

import k3sUpdateService from "@/server/services/upgrade-services/k3s-update.service";
import paramService, { ParamService } from "@/server/services/param.service";
import { getAdminUserSession } from "@/server/utils/action-wrapper.utils";
import QuickStackVersionInfo from "./qs-version-info";
import K3sUpdateInfo from "./k3s-update-info";
import quickStackService from "@/server/services/qs.service";
import quickStackUpdateService from "@/server/services/qs-update.service";
import clusterAddonRegistryService from "@/server/services/addons/cluster-addon-registry.service";
import ClusterAddonUpdateInfo, { ClusterAddonUpdateInfo as ClusterAddonUpdateInfoModel } from './cluster-addon-update-info';
import { Separator } from '@/components/ui/separator';

export default async function UpdateInfoPage() {

    await getAdminUserSession();

    const [
        useCanaryChannel,
        currentVersion,
        newVersionInfo,
        k3sControllerStatus,
    ] = await Promise.all([
        paramService.getBoolean(ParamService.USE_CANARY_CHANNEL, false, false),
        quickStackService.getVersionOfCurrentQuickstackInstance(),
        quickStackUpdateService.getNewVersionInfo(),
        k3sUpdateService.isSystemUpgradeControllerPresent(),
    ]);

    // Loading K3s data with sideeffects
    let k3sCurrentVersionInfo;
    let k3sNextVersionInfo;
    let k3sUpgradeIsInProgress = false;
    try {
        const [
            k3sCurrentVersionInfoLoaded,
            k3sNextVersionInfoLoaded,
            k3sUpgradeIsInProgressLoaded,
        ] = await Promise.all([
            k3sUpdateService.getVersionInfoForCurrentK3sVersion(),
            k3sUpdateService.getNextAvailableK3sReleaseVersionInfo(),
            k3sUpdateService.isUpgradeInProgress()
        ]);
        k3sCurrentVersionInfo = k3sCurrentVersionInfoLoaded;
        k3sNextVersionInfo = k3sNextVersionInfoLoaded;
        k3sUpgradeIsInProgress = k3sUpgradeIsInProgressLoaded;
    } catch (error) {
        console.error('Error fetching K3s version info:', error);
    }

    const addons: ClusterAddonUpdateInfoModel[] = await Promise.all(clusterAddonRegistryService.getAll()
        .filter((addon) => useCanaryChannel || addon.metadata.id !== 'agent-sandbox')
        .map(async (addon) => {
        try {
            const status = await addon.getStatus();
            let availableVersion: string | undefined;
            let message = status.message;
            if (status.status === 'ready') {
                try {
                availableVersion = (await addon.getAvailableUpdate())?.version;
                } catch (error) {
                    message = error instanceof Error ? error.message : 'Could not check for updates.';
                }
            }
            return { ...addon.metadata, ...status, availableVersion, message };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Could not load add-on status.';
            return { ...addon.metadata, status: 'failed' as const, message };
        }
        }));


    return <div className="grid gap-6">
        <QuickStackVersionInfo newVersionInfo={newVersionInfo} currentVersion={currentVersion} useCanaryChannel={useCanaryChannel!} />
        <K3sUpdateInfo k3sCurrentVersionInfo={k3sCurrentVersionInfo}
            k3sNextVersionInfo={k3sNextVersionInfo}
            k3sUpgradeIsInProgress={k3sUpgradeIsInProgress}
            initialControllerStatus={k3sControllerStatus} />
        <div className="space-y-2 pt-2">
            <Separator />
            <div className="pt-4">
                <h2 className="text-xl font-semibold tracking-tight">Cluster Add-ons</h2>
                <p className="text-sm text-muted-foreground">Install and keep optional cluster components up to date.</p>
            </div>
        </div>
        {addons.map((addon) => <ClusterAddonUpdateInfo key={addon.id} addon={addon} />)}
    </div>;

}
