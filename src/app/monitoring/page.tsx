'use server'

import { getAuthUserSession } from "@/server/utils/action-wrapper.utils";
import PageTitle from "@/components/custom/page-title";
import clusterService from "@/server/services/cluster.service";
import MonitoringClient from "./monitoring-client";
import monitoringService from "@/server/services/monitoring.service";
import { UserGroupUtils } from "@/shared/utils/role.utils";
import { CatchUtils } from "@/shared/utils/catch.utils";

export default async function ResourceNodesInfoPage() {

    const session = await getAuthUserSession();

    let [resourcesNode, volumesUsage, updatedNodeRessources] = await Promise.all([
        CatchUtils.resultOrUndefined(() => clusterService.getNodeResourceUsage()),
        CatchUtils.resultOrUndefined(() => monitoringService.getAllAppVolumesUsage()),
        CatchUtils.resultOrUndefined(() => monitoringService.getMonitoringForAllApps())
    ]);

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
                <MonitoringClient
                    resourcesNodes={resourcesNode}
                    appsRessourceUsage={updatedNodeRessources}
                    volumesUsage={volumesUsage}
                />
            </div>
        </div>
    )
}
