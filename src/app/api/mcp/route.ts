import { v1Api } from '@/server/api/v1/api-index';
import { resolveQuickStackAuthInfo } from '@/server/mcp/mcp-auth';
import { createQuickStackMcpHandler } from '@/server/mcp/mcp-handler';

export const dynamic = 'force-dynamic';

const mcpHandler = createQuickStackMcpHandler({
    app: v1Api,
    resolveAuthInfo: resolveQuickStackAuthInfo,
});

export const POST = mcpHandler.fetch;
export const GET = mcpHandler.fetch;
export const DELETE = mcpHandler.fetch;
