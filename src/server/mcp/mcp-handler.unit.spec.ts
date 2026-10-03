import { Elysia } from 'elysia';
import { z } from 'zod';
import type { AuthInfo } from '@modelcontextprotocol/server';
import { createQuickStackMcpHandler } from './mcp-handler';
import type { QuickStackMcpHandler } from './mcp-handler';

const VALID_TOKEN = 'valid-token';

function unauthorized() {
    return new Response(JSON.stringify({ title: 'Unauthorized' }), { status: 401 });
}

function buildFixtureApp() {
    const unauthorizedSchema = z.object({ title: z.string() });

    return new Elysia({ prefix: '/api/v1' })
        .derive(({ request }) => ({ authenticated: request.headers.get('authorization') === `Bearer ${VALID_TOKEN}` }))
        .get('/projects', ({ authenticated }) => {
            if (!authenticated) return unauthorized();
            return [{ id: 'p1', name: 'Demo' }];
        }, {
            response: { 200: z.array(z.object({ id: z.string(), name: z.string() })), 401: unauthorizedSchema },
            detail: { operationId: 'listProjects', summary: 'List projects', tags: ['Projects'] },
        })
        .get('/projects/:id', ({ params, query, authenticated }) => {
            if (!authenticated) return unauthorized();
            return { id: params.id, search: query.search ?? null };
        }, {
            params: z.object({ id: z.string() }),
            query: z.object({ search: z.string().optional() }),
            response: { 200: z.object({ id: z.string(), search: z.string().nullable() }), 401: unauthorizedSchema },
            detail: { operationId: 'getProject', summary: 'Get project', tags: ['Projects'] },
        })
        .post('/projects', ({ body, authenticated }) => {
            if (!authenticated) return unauthorized();
            return { id: 'p2', name: body.name };
        }, {
            body: z.object({ name: z.string() }),
            response: { 200: z.object({ id: z.string(), name: z.string() }), 401: unauthorizedSchema },
            detail: { operationId: 'saveProject', summary: 'Save project', tags: ['Projects'] },
        })
        .put('/agents/:agentId/sandboxes/:sandboxName/files/write', ({ body, authenticated }) => {
            if (!authenticated) return unauthorized();
            return { path: body.path };
        }, {
            body: z.object({ path: z.string() }),
            response: { 200: z.object({ path: z.string() }), 401: unauthorizedSchema },
            detail: { operationId: 'writeAgentSandboxFile', summary: 'Write sandbox file', tags: ['Agent Sandboxes'] },
        })
        .post('/upload', () => new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } }), {
            parse: 'none',
            response: { 200: z.object({ ok: z.boolean() }) },
            detail: { operationId: 'uploadFile', summary: 'Upload a file', tags: ['Files'] },
        })
        .get('/logs/stream', () => new Response('stream'), {
            detail: { operationId: 'streamLogs', summary: 'Stream logs', tags: ['Logs'] },
        });
}

function buildHandler(overrides?: { resolveAuthInfo?: (request: Request) => Promise<AuthInfo | null> }): QuickStackMcpHandler {
    const app = buildFixtureApp();
    return createQuickStackMcpHandler({
        app,
        resolveAuthInfo: overrides?.resolveAuthInfo ?? (async (request) => {
            if (request.headers.get('authorization') !== `Bearer ${VALID_TOKEN}`) {
                return null;
            }
            return { token: VALID_TOKEN, clientId: 'user-1', scopes: [] };
        }),
    });
}

function jsonRpcRequest(options: {
    method: string;
    params?: Record<string, unknown>;
    token?: string | null;
    toolName?: string;
    origin?: string;
}) {
    const { method, params, token = VALID_TOKEN, toolName, origin } = options;
    const headers: Record<string, string> = {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        'mcp-protocol-version': '2026-07-28',
        'mcp-method': method,
    };
    if (toolName) {
        headers['mcp-name'] = toolName;
    }
    if (token) {
        headers.authorization = `Bearer ${token}`;
    }
    if (origin) {
        headers.origin = origin;
    }
    return new Request('http://localhost/api/mcp', {
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
                    'io.modelcontextprotocol/clientInfo': { name: 'test', version: '1.0.0' },
                },
            },
        }),
    });
}

async function listTools(handler: QuickStackMcpHandler) {
    const response = await handler.fetch(jsonRpcRequest({ method: 'tools/list' }));
    return { status: response.status, body: await response.json() };
}

async function callTool(handler: QuickStackMcpHandler, name: string, args: Record<string, unknown>) {
    const response = await handler.fetch(jsonRpcRequest({
        method: 'tools/call',
        toolName: name,
        params: { name, arguments: args },
    }));
    return { status: response.status, body: await response.json() };
}

describe('QuickStack MCP handler', () => {
    it('lists the search, read and write tools', async () => {
        const { status, body } = await listTools(buildHandler());

        expect(status).toBe(200);
        const names = body.result.tools.map((tool: { name: string }) => tool.name).sort();
        expect(names).toEqual(['execute_operation', 'execute_read_operation', 'search_operations']);
    });

    it('rejects a request with an invalid REST API Key', async () => {
        const response = await buildHandler().fetch(jsonRpcRequest({ method: 'tools/list', token: 'wrong-token' }));
        expect(response.status).toBe(401);
    });

    it('rejects a request with no credential', async () => {
        const response = await buildHandler().fetch(jsonRpcRequest({ method: 'tools/list', token: null }));
        expect(response.status).toBe(401);
    });

    it('rejects a cross-origin browser request', async () => {
        const response = await buildHandler().fetch(jsonRpcRequest({ method: 'tools/list', origin: 'https://evil.example' }));
        expect(response.status).toBe(403);
    });

    it('accepts a same-origin browser request', async () => {
        const response = await buildHandler().fetch(jsonRpcRequest({ method: 'tools/list', origin: 'http://localhost' }));
        expect(response.status).toBe(200);
    });

    it('derives operations from the routes in deterministic id order', async () => {
        const { body } = await callTool(buildHandler(), 'search_operations', {});
        const operations = body.result.structuredContent.operations as Array<{ operationId: string }>;
        const ids = operations.map((operation) => operation.operationId);

        expect(ids).toEqual([...ids].sort());
        expect(ids).toContain('listProjects');
        expect(ids).toContain('getProject');
    });

    it('filters operations by search term', async () => {
        const { body } = await callTool(buildHandler(), 'search_operations', { search: 'log' });
        const operations = body.result.structuredContent.operations as Array<{ operationId: string }>;

        expect(operations.map((operation) => operation.operationId)).toEqual(['streamLogs']);
    });

    it('returns schemas only at the full detail level', async () => {
        const summary = await callTool(buildHandler(), 'search_operations', { search: 'getProject', detail: 'summary' });
        const full = await callTool(buildHandler(), 'search_operations', { search: 'getProject', detail: 'full' });

        const summaryOperation = summary.body.result.structuredContent.operations[0];
        const fullOperation = full.body.result.structuredContent.operations[0];

        expect(summaryOperation.bodySchema).toBeUndefined();
        expect(fullOperation.pathParamsSchema).toBeDefined();
        expect(fullOperation.querySchema).toBeDefined();
    });

    it('marks excluded, streaming, and manually parsed operations as unsupported', async () => {
        const { body } = await callTool(buildHandler(), 'search_operations', { detail: 'full' });
        const operations = body.result.structuredContent.operations as Array<{
            operationId: string;
            supported: boolean;
            unsupportedReason?: string;
        }>;

        const writeAgentSandboxFile = operations.find((operation) => operation.operationId === 'writeAgentSandboxFile');
        const streamLogs = operations.find((operation) => operation.operationId === 'streamLogs');
        const uploadFile = operations.find((operation) => operation.operationId === 'uploadFile');
        const listProjects = operations.find((operation) => operation.operationId === 'listProjects');

        expect(writeAgentSandboxFile).toMatchObject({
            supported: false,
            unsupportedReason: 'Operation is excluded from MCP.',
        });
        expect(streamLogs?.supported).toBe(false);
        expect(uploadFile?.supported).toBe(false);
        expect(listProjects?.supported).toBe(true);
    });

    it('reports readOnly and the matching tool for each operation', async () => {
        const { body } = await callTool(buildHandler(), 'search_operations', { detail: 'full' });
        const operations = body.result.structuredContent.operations as Array<{ operationId: string; readOnly: boolean; tool: string }>;
        const byId = new Map(operations.map((operation) => [operation.operationId, operation]));

        expect(byId.get('listProjects')).toMatchObject({ readOnly: true, tool: 'execute_read_operation' });
        expect(byId.get('getProject')).toMatchObject({ readOnly: true, tool: 'execute_read_operation' });
        expect(byId.get('saveProject')).toMatchObject({ readOnly: false, tool: 'execute_operation' });
    });

    it('executes a read operation and returns the REST payload', async () => {
        const { body } = await callTool(buildHandler(), 'execute_read_operation', { operationId: 'listProjects' });

        expect(body.result.isError).not.toBe(true);
        expect(body.result.structuredContent.result).toEqual([{ id: 'p1', name: 'Demo' }]);
    });

    it('maps path params and query arguments onto the REST route', async () => {
        const { body } = await callTool(buildHandler(), 'execute_read_operation', {
            operationId: 'getProject',
            pathParams: { id: 'p-42' },
            query: { search: 'needle' },
        });

        expect(body.result.structuredContent.result).toEqual({ id: 'p-42', search: 'needle' });
    });

    it('sends the request body for write operations', async () => {
        const { body } = await callTool(buildHandler(), 'execute_operation', {
            operationId: 'saveProject',
            body: { name: 'New project' },
        });

        expect(body.result.structuredContent.result).toEqual({ id: 'p2', name: 'New project' });
    });

    it('forwards the bearer credential to the REST route', async () => {
        const { body } = await callTool(buildHandler(), 'execute_read_operation', { operationId: 'listProjects' });

        expect(body.result.isError).not.toBe(true);
        expect(body.result.structuredContent.result).toHaveLength(1);
    });

    it('rejects a mutating operation on the read tool', async () => {
        const { body } = await callTool(buildHandler(), 'execute_read_operation', { operationId: 'saveProject', body: { name: 'x' } });

        expect(body.result.isError).toBe(true);
        expect(body.result.content[0].text).toContain('execute_operation');
    });

    it('rejects a read-only operation on the write tool', async () => {
        const { body } = await callTool(buildHandler(), 'execute_operation', { operationId: 'listProjects' });

        expect(body.result.isError).toBe(true);
        expect(body.result.content[0].text).toContain('execute_read_operation');
    });

    it('returns a tool error for an unknown operation id', async () => {
        const { body } = await callTool(buildHandler(), 'execute_operation', { operationId: 'doesNotExist' });

        expect(body.result.isError).toBe(true);
        expect(body.result.content[0].text).toContain('doesNotExist');
    });

    it('returns a tool error for an unsupported operation', async () => {
        const { body } = await callTool(buildHandler(), 'execute_read_operation', { operationId: 'streamLogs' });

        expect(body.result.isError).toBe(true);
    });

    it('returns a tool error carrying the REST problem detail on failure', async () => {
        const app = buildFixtureApp();
        const handler = createQuickStackMcpHandler({
            app,
            resolveAuthInfo: async () => ({ token: 'wrong', clientId: 'user-1', scopes: [] }),
        });

        const { body } = await callTool(handler, 'execute_read_operation', { operationId: 'listProjects' });

        expect(body.result.isError).toBe(true);
        expect(body.result.content[0].text).toContain('401');
    });
});
