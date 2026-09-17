import clusterService from "@/server/services/cluster.service"
import { getBuildSettings } from "../../actions"
import QsBuildSettings from "./qs-build-settings"
import { ServerSettingsPage } from "../../server-settings-page"

export default async function BuildSettingsPage() {
  const [buildSettings, nodeInfo] = await Promise.all([
    getBuildSettings(),
    clusterService.getNodeInfo(),
  ])

  return <ServerSettingsPage title="Builds">
    <div className="grid gap-6">
      <QsBuildSettings buildSettings={buildSettings} nodes={nodeInfo} />
    </div>
  </ServerSettingsPage>
}
