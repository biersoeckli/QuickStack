import { Constants } from "@/shared/utils/constants"
import podService from "@/server/services/pod.service"
import QuickStackMaintenanceSettings from "./qs-maintenance-settings"
import { ServerSettingsPage } from "../../server-settings-page"

export default async function MaintenanceSettingsPage() {
  const pods = await podService.getPodsForApp(Constants.QS_NAMESPACE, Constants.QS_APP_NAME)
  const pod = pods.find(Boolean)

  return <ServerSettingsPage title="Maintenance">
    <div className="grid gap-6">
      <QuickStackMaintenanceSettings qsPodName={pod?.podName} />
    </div>
  </ServerSettingsPage>
}
