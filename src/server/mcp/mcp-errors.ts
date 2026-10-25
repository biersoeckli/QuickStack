/**
 * JSON-RPC error codes emitted by the QuickStack MCP endpoint.
 *
 * The MCP specification (2026-07-28) reserves -32768..-32000 for JSON-RPC and
 * MCP-defined errors. Application-defined codes belong outside that range.
 * The deprecated MCP code -32002 must not be emitted anymore.
 */
export const MCP_ERROR_CODES = {
    SERVER_DISABLED: 1001,
    UNAUTHORIZED: 1002,
} as const;

export type McpErrorCode = typeof MCP_ERROR_CODES[keyof typeof MCP_ERROR_CODES];

export function jsonRpcErrorResponse(options: {
    code: McpErrorCode;
    message: string;
    status: number;
    headers?: Record<string, string>;
}): Response {
    const { code, message, status, headers } = options;
    return new Response(
        JSON.stringify({ jsonrpc: '2.0', id: null, error: { code, message } }),
        {
            status,
            headers: {
                'content-type': 'application/json',
                ...headers,
            },
        }
    );
}
