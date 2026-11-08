import paramService from "@/server/services/param.service"
import { getAdminUserSession } from "@/server/utils/action-wrapper.utils"
import { ServerSettingsPage } from "../../server-settings-page"
import McpSettings from "./mcp-settings"

export default async function McpSettingsPage() {
    await getAdminUserSession()
    const [mcpMode, sendSecrets] = await Promise.all([
        paramService.getMcpServerMode(),
        paramService.getMcpSendSecrets(),
    ])
    return <ServerSettingsPage title="MCP Server" category="Developer" categoryHref="/settings/developer/mcp">
        <McpSettings mcpMode={mcpMode} sendSecrets={sendSecrets} />
    </ServerSettingsPage>
}
