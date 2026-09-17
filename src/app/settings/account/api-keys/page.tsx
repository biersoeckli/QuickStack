import { getAuthUserSession } from "@/server/utils/action-wrapper.utils"
import userService from "@/server/services/user.service"
import restApiKeyService from "@/server/services/rest-api-key.service"
import RestApiKeysCard, { CreateRestApiKeyButton } from "./rest-api-keys-card"
import { ServerSettingsPage } from "../../server-settings-page"

export default async function ApiKeysSettingsPage() {
  const session = await getAuthUserSession()
  const user = await userService.getUserByEmail(session.email)
  const apiKeys = await restApiKeyService.listByUserId(user.id)
  return <ServerSettingsPage title="API Keys" category="Account & Access" categoryHref="/settings/account/profile" actions={<CreateRestApiKeyButton />}>
    <RestApiKeysCard initialApiKeys={apiKeys} showCreateButton={false} />
  </ServerSettingsPage>
}
