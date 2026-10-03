import { v1Api } from '@/server/api/v1/api-index';
import { resolveQuickStackAuthInfo } from '@/server/mcp/mcp-auth';
import { createQuickStackMcpHandler } from '@/server/mcp/mcp-handler';
import paramService, { ParamService } from '@/server/services/param.service';

export const dynamic = 'force-dynamic';

const mcpHandler = createQuickStackMcpHandler({
    app: v1Api,
    resolveAuthInfo: resolveQuickStackAuthInfo,
});

async function handleRequest(request: Request): Promise<Response> {
    const [canaryEnabled, enabled] = await Promise.all([
        paramService.getBoolean(ParamService.USE_CANARY_CHANNEL),
        paramService.getBoolean(ParamService.MCP_SERVER_ENABLED),
    ]);

    if (!canaryEnabled || !enabled) {
        return new Response(
            JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32002, message: 'MCP server is disabled.' } }),
            {
                status: 404,
                headers: { 'content-type': 'application/json' },
            }
        );
    }

    return mcpHandler.fetch(request);
}

export const POST = handleRequest;
export const GET = handleRequest;
export const DELETE = handleRequest;
