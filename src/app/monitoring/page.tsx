'use server'

import { getAuthUserSession } from "@/server/utils/action-wrapper.utils";
import PageTitle from "@/components/custom/page-title";
import clusterService from "@/server/services/cluster.service";
import ResourceNodes from "./monitoring-nodes";
import { NodeResourceModel } from "@/shared/model/node-resource.model";
import { AppVolumeMonitoringUsageModel } from "@/shared/model/app-volume-monitoring-usage.model";
import monitoringService from "@/server/services/monitoring.service";
import AppRessourceMonitoring from "./app-monitoring";
import AppVolumeMonitoring from "./app-volumes-monitoring";
import { AppMonitoringUsageModel } from "@/shared/model/app-monitoring-usage.model";
import { UserGroupUtils } from "@/shared/utils/role.utils";

export default async function ResourceNodesInfoPage() {

    const session = await getAuthUserSession();
    let resourcesNode: NodeResourceModel[] | undefined;
    let volumesUsage: AppVolumeMonitoringUsageModel[] | undefined;
    let updatedNodeRessources: AppMonitoringUsageModel[] | undefined;
    try {
        [resourcesNode, volumesUsage, updatedNodeRessources] = await Promise.all([
            clusterService.getNodeResourceUsage(),
            monitoringService.getAllAppVolumesUsage(),
            await monitoringService.getMonitoringForAllApps()
        ]);
    } catch (ex) {
        // do nothing --> if an error occurs, the ResourceNodes will show a loading spinner and error message
    }

    // filter by role
    volumesUsage = volumesUsage?.filter((volume) => UserGroupUtils.sessionHasReadAccessForApp(session, volume.appId));
    // only base volumes, no shared volumes
    volumesUsage = volumesUsage?.filter((volume) => !!volume.isBaseVolume);
    updatedNodeRessources = updatedNodeRessources?.filter((app) => UserGroupUtils.sessionHasReadAccessForApp(session, app.appId));

    return (
        <div className="flex-1 space-y-4 pt-6">
            <PageTitle
                title={'Monitoring'}
                subtitle={`View all resources of the nodes which belong to the QuickStack Cluster.`}>
            </PageTitle>
            <div className="space-y-6">
                <ResourceNodes resourcesNodes={resourcesNode} />
                <AppRessourceMonitoring appsRessourceUsage={updatedNodeRessources} />
                <AppVolumeMonitoring volumesUsage={volumesUsage} />
            </div>
        </div>
    )
}
