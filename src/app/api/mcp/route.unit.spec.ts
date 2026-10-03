const routeMocks = vi.hoisted(() => ({
    getBoolean: vi.fn(),
    mcpFetch: vi.fn(),
}));

vi.mock('@/server/services/param.service', () => ({
    default: { getBoolean: routeMocks.getBoolean },
    ParamService: { MCP_SERVER_ENABLED: 'mcpServerEnabled' },
}));

vi.mock('@/server/api/v1/api-index', () => ({ v1Api: {} }));

vi.mock('@/server/mcp/mcp-auth', () => ({ resolveQuickStackAuthInfo: vi.fn() }));

vi.mock('@/server/mcp/mcp-handler', () => ({
    createQuickStackMcpHandler: () => ({ fetch: routeMocks.mcpFetch }),
}));

import { POST } from './route';

describe('MCP route enablement', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('rejects requests when the MCP server is disabled', async () => {
        routeMocks.getBoolean.mockResolvedValue(false);

        const response = await POST(new Request('http://localhost/api/mcp', { method: 'POST' }));

        expect(response.status).toBe(404);
        expect(routeMocks.mcpFetch).not.toHaveBeenCalled();
    });

    it('delegates to the MCP handler when the MCP server is enabled', async () => {
        routeMocks.getBoolean.mockResolvedValue(true);
        routeMocks.mcpFetch.mockResolvedValue(new Response('handled', { status: 200 }));

        const response = await POST(new Request('http://localhost/api/mcp', { method: 'POST' }));

        expect(response.status).toBe(200);
        expect(routeMocks.mcpFetch).toHaveBeenCalledTimes(1);
    });
});
