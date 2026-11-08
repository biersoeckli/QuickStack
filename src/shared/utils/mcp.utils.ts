import { McpServerMode, mcpServerModeZodModel } from '../model/mcp-settings.model';

export class McpSettingsUtils {

    static isMcpServerMode(value: unknown): value is McpServerMode {
        return mcpServerModeZodModel.safeParse(value).success;
    }

    static isMcpServerEnabled(mode: McpServerMode): boolean {
        return mode !== 'off';
    }
}
