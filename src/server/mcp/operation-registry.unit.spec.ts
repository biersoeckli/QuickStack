import { Elysia } from 'elysia';
import { z } from 'zod';
import { openapi } from '@elysiajs/openapi';
import operationRegistry, { McpSourceApp } from './operation-registry';
import { ApiOperationDetailUtils } from '../utils/api-operation-detail.utils';

const app = new Elysia()
    .post('/apps', () => ({ name: 'web' }), {
        body: z.object({
            name: z.string(),
        }),
        response: {
            200: z.object({
                name: z.string(),
            }),
        },
        detail: ApiOperationDetailUtils.create({
            summary: 'Create app',
            description: 'OpenAPI description for saveApp.',
            'x-mcp-description': 'MCP description for saveApp.',
            operationId: 'saveApp',
            tags: ['Apps'],
        }),
    })
    .get('/apps', () => [], {
        response: {
            200: z.array(z.string()),
        },
        detail: {
            summary: 'List apps',
            description: 'Fallback description for listApps.',
            operationId: 'listApps',
            tags: ['Apps'],
        },
    });

describe('operation registry descriptions', () => {

    it('prefers the MCP description and falls back to the OpenAPI description', () => {
        const descriptors = operationRegistry.build(app as unknown as McpSourceApp);

        expect(descriptors.find((descriptor) => descriptor.operationId === 'saveApp')?.description)
            .toBe('MCP description for saveApp.');
        expect(descriptors.find((descriptor) => descriptor.operationId === 'listApps')?.description)
            .toBe('Fallback description for listApps.');
    });

    it('keeps the OpenAPI description separate and exposes the MCP description as extension', async () => {
        const documentedApp = new Elysia()
            .use(openapi({
                path: '/openapi',
                specPath: '/openapi.json',
            }))
            .use(app);

        const response = await documentedApp.handle(new Request('http://localhost/openapi.json'));
        const document = await response.json() as {
            paths: Record<string, Record<string, Record<string, unknown>>>;
        };

        expect(document.paths['/apps'].post.description).toBe('OpenAPI description for saveApp.');
        expect(document.paths['/apps'].post['x-mcp-description']).toBe('MCP description for saveApp.');
    });
});
