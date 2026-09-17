import { getAuthUserSession } from "@/server/utils/action-wrapper.utils"
import userService from "@/server/services/user.service"
import ProfilePasswordChange from "./profile-password-change"
import ToTpSettings from "./totp-settings"
import { ServerSettingsPage } from "../../server-settings-page"

export default async function ProfileSettingsPage() {
  const session = await getAuthUserSession()
  const user = await userService.getUserByEmail(session.email)
  return <ServerSettingsPage title="Profile & Security" category="Account & Access" categoryHref="/settings/account/profile">
    <div className="space-y-4">
      <ProfilePasswordChange />
      <ToTpSettings totpEnabled={user.twoFaEnabled} />
    </div>
  </ServerSettingsPage>
}
