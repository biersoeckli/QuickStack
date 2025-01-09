'use server'

import { getAuthUserSession } from "@/server/utils/action-wrapper.utils";
import PageTitle from "@/components/custom/page-title";
import clusterService from "@/server/services/node.service";
import ResourceNodes from "./monitoring-nodes";
import { NodeResourceModel } from "@/shared/model/node-resource.model";
import { AppVolumeMonitoringUsageModel } from "@/shared/model/app-volume-monitoring-usage.model";
import monitoringService from "@/server/services/monitoring.service";
import AppRessourceMonitoring from "./app-monitoring";
import AppVolumeMonitoring from "./app-volumes-monitoring";
import { AppMonitoringUsageModel } from "@/shared/model/app-monitoring-usage.model";

export default async function ResourceNodesInfoPage() {

    await getAuthUserSession();
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
