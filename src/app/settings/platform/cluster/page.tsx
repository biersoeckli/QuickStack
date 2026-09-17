import clusterService from "@/server/services/cluster.service"
import paramService, { ParamService } from "@/server/services/param.service"
import NodeInfo from "./nodeInfo"
import { ServerSettingsPage } from "../../server-settings-page"

export default async function ClusterSettingsPage() {
  const [nodeInfo, clusterJoinToken] = await Promise.all([
    clusterService.getNodeInfo(),
    paramService.getString(ParamService.K3S_JOIN_TOKEN),
  ])

  return <ServerSettingsPage title="Cluster">
    <NodeInfo nodeInfos={nodeInfo} clusterJoinToken={clusterJoinToken} />
  </ServerSettingsPage>
}
