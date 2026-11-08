import { v1Api } from '@/server/api/v1/api-index';
import { resolveQuickStackAuthInfo } from '@/server/mcp/mcp-auth';
import { createQuickStackMcpHandler } from '@/server/mcp/mcp-handler';
import paramService from '@/server/services/param.service';
import { MCP_ERROR_CODES, McpResponseUtils } from '@/server/utils/mcp-response.utils';

export const dynamic = 'force-dynamic';

const mcpHandler = createQuickStackMcpHandler({
    app: v1Api,
    resolveAuthInfo: resolveQuickStackAuthInfo,
});

async function handleRequest(request: Request): Promise<Response> {
    const [mode, sendSecrets] = await Promise.all([
        paramService.getMcpServerMode(),
        paramService.getMcpSendSecrets(),
    ]);

    if (mode === 'off') {
        return McpResponseUtils.jsonRpcErrorResponse({
            code: MCP_ERROR_CODES.SERVER_DISABLED,
            message: 'MCP server is disabled.',
            status: 404,
        });
    }

    return mcpHandler.fetch(request, { mode, sendSecrets });
}

// The MCP 2026-07-28 transport is stateless: only POST is supported.
// Next.js answers unsupported methods with 405 automatically.
export const POST = handleRequest;
