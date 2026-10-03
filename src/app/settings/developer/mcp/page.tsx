import { notFound } from "next/navigation"
import paramService, { ParamService } from "@/server/services/param.service"
import { getAdminUserSession } from "@/server/utils/action-wrapper.utils"
import { ServerSettingsPage } from "../../server-settings-page"
import McpSettings from "./mcp-settings"

export default async function McpSettingsPage() {
    await getAdminUserSession()
    const canaryEnabled = await paramService.getBoolean(ParamService.USE_CANARY_CHANNEL)
    if (!canaryEnabled) {
        notFound()
    }
    const mcpEnabled = await paramService.getBoolean(ParamService.MCP_SERVER_ENABLED)
    return <ServerSettingsPage title="MCP Server" category="Developer" categoryHref="/settings/developer/mcp">
        <McpSettings mcpEnabled={mcpEnabled ?? false} />
    </ServerSettingsPage>
}
