import {
    createMcpHandler,
    hostHeaderValidationResponse,
    originValidationResponse,
} from '@modelcontextprotocol/server';
import type { AuthInfo } from '@modelcontextprotocol/server';
import type { McpAuthResolver } from './mcp-auth';
import { jsonRpcErrorResponse, MCP_ERROR_CODES } from './mcp-errors';
import mcpServerFactory from './mcp-server.factory';
import operationRegistry from './operation-registry';
import type { McpSourceApp, OperationDescriptor } from './operation-registry';
import { McpServerMode } from '@/shared/model/mcp-settings.model';
import { McpSettingsUtils } from '@/shared/utils/mcp.utils';

export type QuickStackMcpHandlerOptions = {
    app: McpSourceApp;
    resolveAuthInfo: McpAuthResolver;
    allowedOrigins?: string[];
    allowedHosts?: string[];
};

export type QuickStackMcpRequestOptions = {
    mode?: McpServerMode;
    sendSecrets?: boolean;
};

export type QuickStackMcpHandler = {
    fetch: (request: Request, options?: QuickStackMcpRequestOptions) => Promise<Response>;
    close: () => Promise<void>;
    operations: OperationDescriptor[];
};

const MCP_SERVER_MODE_EXTRA_KEY = 'mcpServerMode';
const MCP_SEND_SECRETS_EXTRA_KEY = 'mcpSendSecrets';

function unauthorizedResponse(): Response {
    return jsonRpcErrorResponse({
        code: MCP_ERROR_CODES.UNAUTHORIZED,
        message: 'Unauthorized',
        status: 401,
        headers: { 'www-authenticate': 'Bearer' },
    });
}

export function createQuickStackMcpHandler(options: QuickStackMcpHandlerOptions): QuickStackMcpHandler {
    const { app, resolveAuthInfo, allowedOrigins = [], allowedHosts } = options;
    const operations = operationRegistry.build(app);

    const handler = createMcpHandler(
        ({ authInfo }) => {
            const extra = authInfo?.extra ?? {};
            const configuredMode = extra[MCP_SERVER_MODE_EXTRA_KEY];
            const mode = McpSettingsUtils.isMcpServerMode(configuredMode) ? configuredMode : 'readwrite';

            return mcpServerFactory.build({
                app,
                operations,
                authInfo,
                mode,
                sendSecrets: extra[MCP_SEND_SECRETS_EXTRA_KEY] === true,
            });
        },
        { responseMode: 'json' }
    );

    const fetch = async (request: Request, options?: QuickStackMcpRequestOptions): Promise<Response> => {
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

        return handler.fetch(request, {
            authInfo: {
                ...authInfo,
                extra: {
                    ...(authInfo.extra ?? {}),
                    [MCP_SERVER_MODE_EXTRA_KEY]: options?.mode ?? 'readwrite',
                    [MCP_SEND_SECRETS_EXTRA_KEY]: options?.sendSecrets ?? false,
                },
            },
        });
    };

    return { fetch, close: () => handler.close(), operations };
}
