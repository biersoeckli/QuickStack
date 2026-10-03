import {
    createMcpHandler,
    hostHeaderValidationResponse,
    originValidationResponse,
} from '@modelcontextprotocol/server';
import type { AuthInfo } from '@modelcontextprotocol/server';
import type { McpAuthResolver } from './mcp-auth';
import mcpServerFactory from './mcp-server.factory';
import { buildOperationRegistry } from './operation-registry';
import type { McpSourceApp, OperationDescriptor } from './operation-registry';

export type QuickStackMcpHandlerOptions = {
    app: McpSourceApp;
    resolveAuthInfo: McpAuthResolver;
    allowedOrigins?: string[];
    allowedHosts?: string[];
};

export type QuickStackMcpHandler = {
    fetch: (request: Request) => Promise<Response>;
    close: () => Promise<void>;
    operations: OperationDescriptor[];
};

function unauthorizedResponse(): Response {
    return new Response(
        JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Unauthorized' } }),
        {
            status: 401,
            headers: {
                'content-type': 'application/json',
                'www-authenticate': 'Bearer',
            },
        }
    );
}

export function createQuickStackMcpHandler(options: QuickStackMcpHandlerOptions): QuickStackMcpHandler {
    const { app, resolveAuthInfo, allowedOrigins = [], allowedHosts } = options;
    const operations = buildOperationRegistry(app);

    const handler = createMcpHandler(
        ({ authInfo }) => mcpServerFactory.build({ app, operations, authInfo }),
        { responseMode: 'json' }
    );

    const fetch = async (request: Request): Promise<Response> => {
        if (allowedHosts && allowedHosts.length > 0) {
            const hostRejected = hostHeaderValidationResponse(request, allowedHosts);
            if (hostRejected) {
                return hostRejected;
            }
        }

        const allowedOriginHostnames = [...allowedOrigins, new URL(request.url).hostname];
        const originRejected = originValidationResponse(request, allowedOriginHostnames);
        if (originRejected) {
            return originRejected;
        }

        let authInfo: AuthInfo | null = null;
        try {
            authInfo = await resolveAuthInfo(request);
        } catch {
            authInfo = null;
        }

        if (!authInfo) {
            return unauthorizedResponse();
        }

        return handler.fetch(request, { authInfo });
    };

    return { fetch, close: () => handler.close(), operations };
}
