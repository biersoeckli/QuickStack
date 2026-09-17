import UpdateInfoPage from "./update-info"
import { ServerSettingsPage } from "../../server-settings-page"

export default async function UpdatesSettingsPage() {
  return <ServerSettingsPage title="Updates & Add-Ons">
    <UpdateInfoPage />
  </ServerSettingsPage>
}
