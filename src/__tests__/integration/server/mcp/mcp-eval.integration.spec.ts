// @vitest-environment node

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { Elysia } from 'elysia';
import { z } from 'zod';
import { createQuickStackMcpHandler } from '@/server/mcp/mcp-handler';

function runHarness(url: string, apiKey: string): Promise<{ code: number | null; stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, ['scripts/mcp-eval.mjs', '--url', url, '--api-key', apiKey], {
            cwd: process.cwd(),
            env: process.env,
        });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
        child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
        child.on('error', reject);
        child.on('close', (code) => resolve({ code, stdout, stderr }));
    });
}

describe('MCP evaluation harness', () => {
    it('runs the scripted tasks against the real MCP handler', async () => {
        const fixture = new Elysia({ prefix: '/api/v1' })
            .get('/projects', ({ query }) => {
                const projects = [{ id: 'p1', name: 'Demo' }, { id: 'p2', name: 'Second' }];
                if (query.limit === undefined) return projects;
                const limit = Number(query.limit);
                return {
                    items: projects.slice(0, limit),
                    total: projects.length,
                    limit,
                    nextCursor: limit < projects.length ? String(limit) : null,
                };
            }, {
                query: z.object({ limit: z.coerce.number().optional() }),
                response: { 200: z.union([z.array(z.object({ id: z.string(), name: z.string() })), z.object({
                    items: z.array(z.object({ id: z.string(), name: z.string() })),
                    total: z.number(),
                    limit: z.number(),
                    nextCursor: z.string().nullable(),
                })]) },
                detail: { operationId: 'listProjects', summary: 'List projects', tags: ['Projects'] },
            })
            .post('/apps/:appId/deploy', ({ params }) => ({ deploymentId: `deploy-${params.appId}` }), {
                params: z.object({ appId: z.string() }),
                query: z.object({ forceRebuild: z.coerce.boolean().optional() }),
                response: { 200: z.object({ deploymentId: z.string() }) },
                detail: { operationId: 'deployApp', summary: 'Deploy app', description: 'Deploy an app.', tags: ['Apps'] },
            });

        const handler = createQuickStackMcpHandler({
            app: fixture,
            resolveAuthInfo: async () => ({ token: 'eval-token', clientId: 'eval', scopes: [] }),
        });
        const server = createServer(async (request, response) => {
            const chunks: Buffer[] = [];
            for await (const chunk of request) {
                chunks.push(Buffer.from(chunk));
            }
            const method = request.method ?? 'GET';
            const body = method === 'GET' || method === 'HEAD'
                ? undefined
                : new Uint8Array(Buffer.concat(chunks));
            const fetchResponse = await handler.fetch(new Request(
                `http://127.0.0.1${request.url ?? '/api/mcp'}`,
                {
                    method,
                    headers: request.headers as Record<string, string>,
                    body,
                }
            ));
            response.statusCode = fetchResponse.status;
            fetchResponse.headers.forEach((value, key) => response.setHeader(key, value));
            response.end(Buffer.from(await fetchResponse.arrayBuffer()));
        });
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

        try {
            const address = server.address();
            if (!address || typeof address === 'string') {
                throw new Error('Test server did not expose a port.');
            }
            const { code, stdout, stderr } = await runHarness(
                `http://127.0.0.1:${address.port}/api/mcp`,
                'eval-token'
            );

            expect(stderr).toBe('');
            expect(stdout).toContain('Success: 3/3 tasks');
            expect(code).toBe(0);
        } finally {
            await handler.close();
            await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
        }
    }, 60_000);
});
