import { getAdminUserSession } from "@/server/utils/action-wrapper.utils"
import ssoProviderService from "@/server/services/sso-provider.service"
import userGroupService from "@/server/services/user-group.service"
import SsoProvidersTable from "./sso-providers-table"
import SsoProviderEditOverlay from "./sso-provider-edit-overlay"
import { ServerSettingsPage } from "../../server-settings-page"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react";

export default async function SsoProvidersSettingsPage() {
  await getAdminUserSession()
  const [ssoProviders, userGroups] = await Promise.all([
    ssoProviderService.getAll(),
    userGroupService.getAll(),
  ])

  return <ServerSettingsPage title="SSO Providers" category="Account & Access" categoryHref="/settings/access/users" actions={<SsoProviderEditOverlay userGroups={userGroups}>
    <Button> <Plus /> Add SSO Provider</Button>
  </SsoProviderEditOverlay>}>
    <SsoProvidersTable ssoProviders={ssoProviders} userGroups={userGroups} />
  </ServerSettingsPage>
}
