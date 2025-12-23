'use server'

import { getAdminUserSession, getAuthUserSession } from "@/server/utils/action-wrapper.utils";
import PageTitle from "@/components/custom/page-title";
import clusterService from "@/server/services/node.service";
import NodeInfo from "./nodeInfo";
import AddClusterNodeDialog from "./add-cluster-node-dialog";
import { Button } from "@/components/ui/button";
import paramService, { ParamService } from "@/server/services/param.service";
import BreadcrumbSetter from "@/components/breadcrumbs-setter";

export default async function ClusterInfoPage() {

    const session = await getAdminUserSession();
    const nodeInfo = await clusterService.getNodeInfo();
    const clusterJoinToken = await paramService.getString(ParamService.K3S_JOIN_TOKEN);

    return (
        <div className="flex-1 space-y-4 pt-6">
            <PageTitle
                title={'Cluster'}
                subtitle={`View all Nodes of your current QuickStack cluster.`}>
                <AddClusterNodeDialog clusterJoinToken={clusterJoinToken}>
                    <Button>Add Cluster Node</Button>
                </AddClusterNodeDialog>
            </PageTitle>
            <BreadcrumbSetter items={[
                { name: "Settings", url: "/settings/profile" },
                { name: "Cluster" },
            ]} />
            <NodeInfo nodeInfos={nodeInfo} />
        </div>
    )
}
