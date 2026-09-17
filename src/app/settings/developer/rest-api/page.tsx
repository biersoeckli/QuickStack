import paramService, { ParamService } from "@/server/services/param.service"
import { getAdminUserSession } from "@/server/utils/action-wrapper.utils"
import RestApiSettings from "./rest-api-settings"
import { ServerSettingsPage } from "../../server-settings-page"

export default async function RestApiSettingsPage() {
  await getAdminUserSession()
  const openApiEnabled = await paramService.getBoolean(ParamService.API_OPEN_API_SPEC_ENABLED)
  return <ServerSettingsPage title="REST API" category="Developer" categoryHref="/settings/developer/rest-api">
    <RestApiSettings openApiEnabled={openApiEnabled!} />
  </ServerSettingsPage>
}
