const routeMocks = vi.hoisted(() => ({
    getBoolean: vi.fn(),
    mcpFetch: vi.fn(),
}));

vi.mock('@/server/services/param.service', () => ({
    default: { getBoolean: routeMocks.getBoolean },
    ParamService: { MCP_SERVER_ENABLED: 'mcpServerEnabled', USE_CANARY_CHANNEL: 'useCanaryChannel' },
}));

vi.mock('@/server/api/v1/api-index', () => ({ v1Api: {} }));

vi.mock('@/server/mcp/mcp-auth', () => ({ resolveQuickStackAuthInfo: vi.fn() }));

vi.mock('@/server/mcp/mcp-handler', () => ({
    createQuickStackMcpHandler: () => ({ fetch: routeMocks.mcpFetch }),
}));

import { POST } from './route';

function setParams(values: { canary: boolean; mcp: boolean }) {
    routeMocks.getBoolean.mockImplementation(async (name: string) => {
        if (name === 'useCanaryChannel') {
            return values.canary;
        }
        if (name === 'mcpServerEnabled') {
            return values.mcp;
        }
        return undefined;
    });
}

describe('MCP route enablement', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('rejects requests when the MCP server is disabled', async () => {
        setParams({ canary: true, mcp: false });

        const response = await POST(new Request('http://localhost/api/mcp', { method: 'POST' }));

        expect(response.status).toBe(404);
        expect(routeMocks.mcpFetch).not.toHaveBeenCalled();
    });

    it('rejects requests when the canary channel is disabled', async () => {
        setParams({ canary: false, mcp: true });

        const response = await POST(new Request('http://localhost/api/mcp', { method: 'POST' }));

        expect(response.status).toBe(404);
        expect(routeMocks.mcpFetch).not.toHaveBeenCalled();
    });

    it('delegates to the MCP handler when canary and the MCP server are enabled', async () => {
        setParams({ canary: true, mcp: true });
        routeMocks.mcpFetch.mockResolvedValue(new Response('handled', { status: 200 }));

        const response = await POST(new Request('http://localhost/api/mcp', { method: 'POST' }));

        expect(response.status).toBe(200);
        expect(routeMocks.mcpFetch).toHaveBeenCalledTimes(1);
    });
});
