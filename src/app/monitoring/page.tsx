'use server'

import { getAuthUserSession } from "@/server/utils/action-wrapper.utils";
import PageTitle from "@/components/custom/page-title";
import clusterService from "@/server/services/node.service";
import ResourceNodes from "./monitoring-nodes";

export default async function ResourceNodesInfoPage() {

    await getAuthUserSession();
    const resourcesNode = await clusterService.getNodeResourceUsage();
    return (
        <div className="flex-1 space-y-4 pt-6">
            <PageTitle
                title={'Monitoring'}
                subtitle={`View all resources of the nodes which belong to the QuickStack Cluster.`}>
            </PageTitle>
            <ResourceNodes resourcesNodes={resourcesNode} />
        </div>
    )
}
