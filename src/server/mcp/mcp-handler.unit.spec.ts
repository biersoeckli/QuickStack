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
        .get('/project-activity', ({ authenticated }) => {
            if (!authenticated) return unauthorized();
            return { activity: [] };
        }, {
            response: { 200: z.object({ activity: z.array(z.string()) }), 401: unauthorizedSchema },
            detail: { operationId: 'getProjectActivity', summary: 'Get project activity', tags: ['Activity'] },
        })
        .post('/projects', ({ body, authenticated }) => {
            if (!authenticated) return unauthorized();
            return { id: 'p2', name: body.name };
        }, {
            body: z.object({ name: z.string() }),
            response: { 200: z.object({ id: z.string(), name: z.string() }), 401: unauthorizedSchema },
            detail: { operationId: 'saveProject', summary: 'Save project', tags: ['Projects'] },
        })
        .post('/apps/:appId/deploy', ({ params, authenticated }) => {
            if (!authenticated) return unauthorized();
            return { deploymentId: `deploy-${params.appId}` };
        }, {
            params: z.object({ appId: z.string() }),
            response: { 200: z.object({ deploymentId: z.string() }), 401: unauthorizedSchema },
            detail: { operationId: 'deployApp', summary: 'Deploy app', description: 'Starts a build and rollout for the app.', tags: ['Apps'] },
        })
        .get('/huge', () => ({ blob: 'x'.repeat(100_000) }), {
            response: { 200: z.object({ blob: z.string() }) },
            detail: { operationId: 'getHugePayload', summary: 'Get huge payload', tags: ['Testing'] },
        })
        .get('/field-error', () => new Response(JSON.stringify({
            type: 'about:blank',
            title: 'Unprocessable Entity',
            status: 422,
            detail: 'Request validation failed.',
            errors: [
                { path: 'name', message: 'Too small: expected string to have >=3 characters' },
                { path: 'appDomains.0.hostname', message: 'Invalid hostname' },
            ],
        }), {
            status: 422,
            headers: { 'content-type': 'application/problem+json' },
        }), {
            response: { 200: z.object({ ok: z.boolean() }), 422: z.object({ title: z.string(), errors: z.array(z.object({ path: z.string(), message: z.string() })) }) },
            detail: { operationId: 'getFieldErrors', summary: 'Get field errors', tags: ['Testing'] },
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
        expect(names).toEqual([
            'quickstack_execute_operation',
            'quickstack_execute_read_operation',
            'quickstack_search_operations',
        ]);
    });

    it('publishes server instructions that describe the workflow', async () => {
        const response = await buildHandler().fetch(jsonRpcRequest({ method: 'server/discover' }));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.result.instructions).toContain('quickstack_search_operations');
        expect(body.result.instructions).toContain('ask the user for confirmation');
    });

    it('rejects a request with an invalid REST API Key', async () => {
        const response = await buildHandler().fetch(jsonRpcRequest({ method: 'tools/list', token: 'wrong-token' }));
        expect(response.status).toBe(401);
    });

    it('rejects a request with no credential', async () => {
        const response = await buildHandler().fetch(jsonRpcRequest({ method: 'tools/list', token: null }));
        const body = await response.json();

        expect(response.status).toBe(401);
        expect(body.error).toEqual({ code: 1002, message: 'Unauthorized' });
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
        const { body } = await callTool(buildHandler(), 'quickstack_search_operations', {});
        const operations = body.result.structuredContent.operations as Array<{ operationId: string }>;
        const ids = operations.map((operation) => operation.operationId);

        expect(ids).toEqual([...ids].sort());
        expect(ids).toContain('listProjects');
        expect(ids).toContain('getProject');
    });

    it('filters operations by search term', async () => {
        const { body } = await callTool(buildHandler(), 'quickstack_search_operations', { search: 'log' });
        const operations = body.result.structuredContent.operations as Array<{ operationId: string }>;

        expect(operations.map((operation) => operation.operationId)).toEqual(['streamLogs']);
    });

    it('returns schemas only at the full detail level', async () => {
        const summary = await callTool(buildHandler(), 'quickstack_search_operations', { search: 'getProject', detail: 'summary' });
        const full = await callTool(buildHandler(), 'quickstack_search_operations', { search: 'getProject', detail: 'full' });

        const summaryOperation = summary.body.result.structuredContent.operations[0];
        const fullOperation = full.body.result.structuredContent.operations[0];

        expect(summaryOperation.bodySchema).toBeUndefined();
        expect(fullOperation.pathParamsSchema).toBeDefined();
        expect(fullOperation.querySchema).toBeDefined();
    });

    it('marks excluded, streaming, and manually parsed operations as unsupported', async () => {
        const { body } = await callTool(buildHandler(), 'quickstack_search_operations', { detail: 'summary' });
        const operations = body.result.structuredContent.operations as Array<{
            operationId: string;
            supported: boolean;
            unsupportedReason?: string;
        }>;

        const writeAgentSandboxFile = operations.find((operation) => operation.operationId === 'writeAgentSandboxFile');
        const streamLogs = operations.find((operation) => operation.operationId === 'streamLogs');
        const uploadFile = operations.find((operation) => operation.operationId === 'uploadFile');
        const listProjects = operations.find((operation) => operation.operationId === 'listProjects');

        expect(writeAgentSandboxFile?.supported).toBe(false);
        expect(streamLogs?.supported).toBe(false);
        expect(uploadFile?.supported).toBe(false);
        expect(listProjects?.supported).toBe(true);

        const full = await callTool(buildHandler(), 'quickstack_search_operations', {
            search: 'writeAgentSandboxFile',
            detail: 'full',
        });
        expect(full.body.result.structuredContent.operations[0].unsupportedReason).toBe('Operation is excluded from MCP.');
    });

    it('reports readOnly and the matching tool for each operation', async () => {
        const { body } = await callTool(buildHandler(), 'quickstack_search_operations', { detail: 'summary' });
        const operations = body.result.structuredContent.operations as Array<{ operationId: string; readOnly: boolean; tool: string }>;
        const byId = new Map(operations.map((operation) => [operation.operationId, operation]));

        expect(byId.get('listProjects')).toMatchObject({ readOnly: true, tool: 'quickstack_execute_read_operation' });
        expect(byId.get('getProject')).toMatchObject({ readOnly: true, tool: 'quickstack_execute_read_operation' });
        expect(byId.get('saveProject')).toMatchObject({ readOnly: false, tool: 'quickstack_execute_operation' });
    });

    it('executes a read operation and returns the REST payload', async () => {
        const { body } = await callTool(buildHandler(), 'quickstack_execute_read_operation', { operationId: 'listProjects' });

        expect(body.result.isError).not.toBe(true);
        expect(body.result.structuredContent.result).toEqual([{ id: 'p1', name: 'Demo' }]);
    });

    it('maps path params and query arguments onto the REST route', async () => {
        const { body } = await callTool(buildHandler(), 'quickstack_execute_read_operation', {
            operationId: 'getProject',
            pathParams: { id: 'p-42' },
            query: { search: 'needle' },
        });

        expect(body.result.structuredContent.result).toEqual({ id: 'p-42', search: 'needle' });
    });

    it('sends the request body for write operations', async () => {
        const { body } = await callTool(buildHandler(), 'quickstack_execute_operation', {
            operationId: 'saveProject',
            body: { name: 'New project' },
        });

        expect(body.result.structuredContent.result).toEqual({ id: 'p2', name: 'New project' });
    });

    it('forwards the bearer credential to the REST route', async () => {
        const { body } = await callTool(buildHandler(), 'quickstack_execute_read_operation', { operationId: 'listProjects' });

        expect(body.result.isError).not.toBe(true);
        expect(body.result.structuredContent.result).toHaveLength(1);
    });

    it('rejects a mutating operation on the read tool', async () => {
        const { body } = await callTool(buildHandler(), 'quickstack_execute_read_operation', { operationId: 'saveProject', body: { name: 'x' } });

        expect(body.result.isError).toBe(true);
        expect(body.result.content[0].text).toContain('quickstack_execute_operation');
    });

    it('rejects a read-only operation on the write tool', async () => {
        const { body } = await callTool(buildHandler(), 'quickstack_execute_operation', { operationId: 'listProjects' });

        expect(body.result.isError).toBe(true);
        expect(body.result.content[0].text).toContain('quickstack_execute_read_operation');
    });

    it('returns a tool error for an unknown operation id', async () => {
        const { body } = await callTool(buildHandler(), 'quickstack_execute_operation', { operationId: 'doesNotExist' });

        expect(body.result.isError).toBe(true);
        expect(body.result.content[0].text).toContain('doesNotExist');
    });

    it('returns a tool error for an unsupported operation', async () => {
        const { body } = await callTool(buildHandler(), 'quickstack_execute_read_operation', { operationId: 'streamLogs' });

        expect(body.result.isError).toBe(true);
    });

    it('returns a tool error carrying the REST problem detail on failure', async () => {
        const app = buildFixtureApp();
        const handler = createQuickStackMcpHandler({
            app,
            resolveAuthInfo: async () => ({ token: 'wrong', clientId: 'user-1', scopes: [] }),
        });

        const { body } = await callTool(handler, 'quickstack_execute_read_operation', { operationId: 'listProjects' });

        expect(body.result.isError).toBe(true);
        expect(body.result.content[0].text).toContain('401');
    });

    it('requires a search term for the full detail level', async () => {
        const { body } = await callTool(buildHandler(), 'quickstack_search_operations', { detail: 'full' });

        expect(body.result.isError).toBe(true);
        expect(body.result.content[0].text).toContain('requires a search term');
    });

    it('combines multiple search words with AND', async () => {
        const matching = await callTool(buildHandler(), 'quickstack_search_operations', { search: 'sandbox file' });
        const incompatible = await callTool(buildHandler(), 'quickstack_search_operations', { search: 'project deploy' });

        const ids = matching.body.result.structuredContent.operations.map((operation: { operationId: string }) => operation.operationId);
        expect(ids).toEqual(['writeAgentSandboxFile']);
        expect(incompatible.body.result.structuredContent.operations).toEqual([]);
        expect(incompatible.body.result.structuredContent.total).toBe(0);
    });

    it('ranks operation id matches above description-only matches', async () => {
        const { body } = await callTool(buildHandler(), 'quickstack_search_operations', { search: 'project', detail: 'name' });
        const ids = body.result.structuredContent.operations.map((operation: { operationId: string }) => operation.operationId);

        expect(ids.indexOf('listProjects')).toBeGreaterThanOrEqual(0);
        expect(ids.indexOf('listProjects')).toBeLessThan(ids.indexOf('getProjectActivity'));
    });

    it('limits search results and hints at the remaining matches', async () => {
        const { body } = await callTool(buildHandler(), 'quickstack_search_operations', { search: 'project', limit: 1 });
        const structured = body.result.structuredContent;

        expect(structured.returned).toBe(1);
        expect(structured.total).toBeGreaterThan(1);
        expect(structured.hint).toContain('Showing 1 of');
    });

    it('truncates oversized operation results with a narrowing hint', async () => {
        const { body } = await callTool(buildHandler(), 'quickstack_execute_read_operation', { operationId: 'getHugePayload' });
        const structured = body.result.structuredContent;

        expect(structured.truncated).toBe(true);
        expect(structured.originalCharacters).toBeGreaterThan(100_000);
        expect(body.result.content[0].text).toContain('Response truncated');
        expect(structured.hint).toContain('Narrow the request');
    });

    it('passes REST field validation errors through to the tool error', async () => {
        const { body } = await callTool(buildHandler(), 'quickstack_execute_read_operation', { operationId: 'getFieldErrors' });

        expect(body.result.isError).toBe(true);
        expect(body.result.content[0].text).toContain('QuickStack returned HTTP 422');
        expect(body.result.content[0].text).toContain('name: Too small');
        expect(body.result.content[0].text).toContain('appDomains.0.hostname: Invalid hostname');
    });
});
