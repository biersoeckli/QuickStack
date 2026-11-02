const routeMocks = vi.hoisted(() => ({
    getBoolean: vi.fn(),
    getMcpServerMode: vi.fn(),
    getMcpSendSecrets: vi.fn(),
    mcpFetch: vi.fn(),
}));

vi.mock('@/server/services/param.service', () => ({
    default: {
        getBoolean: routeMocks.getBoolean,
        getMcpServerMode: routeMocks.getMcpServerMode,
        getMcpSendSecrets: routeMocks.getMcpSendSecrets,
    },
    ParamService: {
        USE_CANARY_CHANNEL: 'useCanaryChannel',
        MCP_SERVER_MODE: 'mcpServerMode',
        MCP_SEND_SECRETS: 'mcpSendSecrets',
    },
}));

vi.mock('@/server/api/v1/api-index', () => ({ v1Api: {} }));

vi.mock('@/server/mcp/mcp-auth', () => ({ resolveQuickStackAuthInfo: vi.fn() }));

vi.mock('@/server/mcp/mcp-handler', () => ({
    createQuickStackMcpHandler: () => ({ fetch: routeMocks.mcpFetch }),
}));

import { POST } from './route';

function setParams(values: {
    canary: boolean;
    mode: 'off' | 'readonly' | 'readwrite';
    sendSecrets?: boolean;
}) {
    routeMocks.getBoolean.mockImplementation(async (name: string) => {
        if (name === 'useCanaryChannel') {
            return values.canary;
        }
        return undefined;
    });
    routeMocks.getMcpServerMode.mockResolvedValue(values.mode);
    routeMocks.getMcpSendSecrets.mockResolvedValue(values.sendSecrets ?? false);
}

describe('MCP route enablement', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('rejects requests when the MCP server mode is off', async () => {
        setParams({ canary: true, mode: 'off' });

        const response = await POST(new Request('http://localhost/api/mcp', { method: 'POST' }));

        expect(response.status).toBe(404);
        expect(routeMocks.mcpFetch).not.toHaveBeenCalled();
    });

    it('rejects requests when the canary channel is disabled', async () => {
        setParams({ canary: false, mode: 'readwrite' });

        const response = await POST(new Request('http://localhost/api/mcp', { method: 'POST' }));

        expect(response.status).toBe(404);
        expect(routeMocks.mcpFetch).not.toHaveBeenCalled();
    });

    it('passes the read-only mode to the MCP handler', async () => {
        setParams({ canary: true, mode: 'readonly', sendSecrets: false });
        routeMocks.mcpFetch.mockResolvedValue(new Response('handled', { status: 200 }));

        const response = await POST(new Request('http://localhost/api/mcp', { method: 'POST' }));

        expect(response.status).toBe(200);
        expect(routeMocks.mcpFetch).toHaveBeenCalledWith(expect.any(Request), {
            mode: 'readonly',
            sendSecrets: false,
        });
    });

    it('passes the read-write mode and secret toggle to the MCP handler', async () => {
        setParams({ canary: true, mode: 'readwrite', sendSecrets: true });
        routeMocks.mcpFetch.mockResolvedValue(new Response('handled', { status: 200 }));

        const response = await POST(new Request('http://localhost/api/mcp', { method: 'POST' }));

        expect(response.status).toBe(200);
        expect(routeMocks.mcpFetch).toHaveBeenCalledWith(expect.any(Request), {
            mode: 'readwrite',
            sendSecrets: true,
        });
    });
});
