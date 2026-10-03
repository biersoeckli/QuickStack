// @vitest-environment node

import mockNextJsCaching from '@/__tests__/nextjs-cache.utils';
mockNextJsCaching();

vi.mock('@/server/adapter/kubernetes-api.adapter', () => ({ default: {} }));

import { createPrismaTestContext } from '@/__tests__/prisma-test.utils';
import { mockPathUtilsForTests } from '@/__tests__/path-test.utils';
import { v1Api } from '@/server/api/v1/api-index';
import { resolveQuickStackAuthInfo } from '@/server/mcp/mcp-auth';
import { createQuickStackMcpHandler } from '@/server/mcp/mcp-handler';
import restApiKeyService from '@/server/services/rest-api-key.service';
import userGroupService from '@/server/services/user-group.service';
import userService from '@/server/services/user.service';
import { PathUtils } from '@/server/utils/path.utils';

function jsonRpcRequest(options: {
    method: string;
    params?: Record<string, unknown>;
    apiKey: string;
    toolName?: string;
}) {
    const { method, params, apiKey, toolName } = options;
    const headers: Record<string, string> = {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        'mcp-protocol-version': '2026-07-28',
        'mcp-method': method,
        authorization: `Bearer ${apiKey}`,
    };
    if (toolName) {
        headers['mcp-name'] = toolName;
    }
    return new Request('http://quickstack.test/api/mcp', {
        method: 'POST',
        headers,
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method,
            params: {
                ...(params ?? {}),
                _meta: {
                    'io.modelcontextprotocol/protocolVersion': '2026-07-28',
                    'io.modelcontextprotocol/clientCapabilities': {},
                    'io.modelcontextprotocol/clientInfo': { name: 'integration', version: '1.0.0' },
                },
            },
        }),
    });
}

describe('QuickStack MCP integration', () => {
    createPrismaTestContext('mcp-handler');
    const { originalInternalDataRoot, originalTempDataRoot } = mockPathUtilsForTests();

    beforeEach(() => {
        process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET ?? 'test-nextauth-secret';
    });

    afterAll(() => {
        if (originalInternalDataRoot) {
            Object.defineProperty(PathUtils, 'internalDataRoot', originalInternalDataRoot);
        }
        if (originalTempDataRoot) {
            Object.defineProperty(PathUtils, 'tempDataRoot', originalTempDataRoot);
        }
        vi.restoreAllMocks();
    });

    async function createAdminApiKey() {
        const adminRole = await userGroupService.getOrCreateAdminRole();
        const user = await userService.registerUser('admin-mcp-test@example.com', 'test-password', adminRole.id);
        return restApiKeyService.create(user.id, 'mcp-integration-test');
    }

    it('derives operations from the real REST API and hides binary routes', async () => {
        const apiKey = await createAdminApiKey();
        const handler = createQuickStackMcpHandler({ app: v1Api, resolveAuthInfo: resolveQuickStackAuthInfo });

        const response = await handler.fetch(jsonRpcRequest({
            method: 'tools/call',
            toolName: 'search_operations',
            apiKey,
            params: { name: 'search_operations', arguments: { detail: 'full' } },
        }));
        const body = await response.json();
        const operations = body.result.structuredContent.operations as Array<{ operationId: string; supported: boolean }>;
        const byId = new Map(operations.map((operation) => [operation.operationId, operation]));

        expect(response.status).toBe(200);
        expect(operations.length).toBeGreaterThan(15);
        expect(byId.has('listProjects')).toBe(true);
        expect(byId.has('listApps')).toBe(true);
        expect(byId.has('saveAgent')).toBe(true);
        expect(byId.get('readAgentSandboxFile')?.supported).toBe(false);
        expect(byId.get('writeAgentSandboxFile')?.supported).toBe(false);
    }, 120_000);

    it('executes a real REST operation through the MCP handler', async () => {
        const apiKey = await createAdminApiKey();
        const handler = createQuickStackMcpHandler({ app: v1Api, resolveAuthInfo: resolveQuickStackAuthInfo });

        const response = await handler.fetch(jsonRpcRequest({
            method: 'tools/call',
            toolName: 'execute_read_operation',
            apiKey,
            params: { name: 'execute_read_operation', arguments: { operationId: 'listProjects' } },
        }));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.result.isError).not.toBe(true);
        expect(body.result.structuredContent.result).toEqual([]);
    }, 120_000);
});
