'use server'

import { getAuthUserSession } from "@/server/utils/action-wrapper.utils";
import PageTitle from "@/components/custom/page-title";
import clusterService from "@/server/services/node.service";
import ResourceNodes from "./monitoring-nodes";
import { NodeResourceModel } from "@/shared/model/node-resource.model";
import { AppVolumeMonitoringUsageModel } from "@/shared/model/app-volume-monitoring-usage.model";
import monitoringService from "@/server/services/monitoring.service";

export default async function ResourceNodesInfoPage() {

    await getAuthUserSession();
    let resourcesNode: NodeResourceModel[] | undefined;
    let volumesUsage: AppVolumeMonitoringUsageModel[] | undefined;
    try {
        resourcesNode = await clusterService.getNodeResourceUsage();
        volumesUsage = await monitoringService.getAllAppVolumesUsage();
    } catch (ex) {
        // do nothing --> if an error occurs, the ResourceNodes will show a loading spinner and error message
    }

    return (
        <div className="flex-1 space-y-4 pt-6">
            <PageTitle
                title={'Monitoring'}
                subtitle={`View all resources of the nodes which belong to the QuickStack Cluster.`}>
            </PageTitle>
            <ResourceNodes resourcesNodes={resourcesNode} volumesUsage={volumesUsage} />
        </div>
    )
}
