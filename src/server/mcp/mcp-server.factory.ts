import { McpServer } from '@modelcontextprotocol/server';
import type { AuthInfo } from '@modelcontextprotocol/server';
import { z } from 'zod';
import operationExecutor from './operation-executor';
import type { McpSourceApp, OperationDescriptor } from './operation-registry';

const searchInputSchema = z.object({
    search: z.string().optional().describe('Free-text match against operation id, summary, description and tags.'),
    detail: z.enum(['name', 'summary', 'full']).optional().default('summary').describe('How much of each operation to return.'),
});

const operationSummarySchema = z.object({
    operationId: z.string(),
    method: z.string(),
    path: z.string(),
    summary: z.string().optional(),
    description: z.string().optional(),
    tags: z.array(z.string()),
    supported: z.boolean(),
});

const operationFullSchema = operationSummarySchema.extend({
    pathParamsSchema: z.unknown().optional(),
    querySchema: z.unknown().optional(),
    bodySchema: z.unknown().optional(),
    responseSchema: z.unknown().optional(),
    unsupportedReason: z.string().optional(),
});

const searchOutputSchema = z.object({
    operations: z.array(operationFullSchema),
});

const executeInputSchema = z.object({
    operationId: z.string().describe('Operation id returned by search_operations.'),
    pathParams: z.record(z.string(), z.unknown()).optional().default({}).describe('Values for the :placeholders in the operation path.'),
    query: z.record(z.string(), z.unknown()).optional().default({}).describe('Query string parameters.'),
    body: z.unknown().optional().describe('JSON request body for write operations.'),
});

const executeOutputSchema = z.object({
    status: z.number().int(),
    result: z.unknown(),
});

const SEARCH_TOOL_DESCRIPTION = [
    'Search the QuickStack operations catalog.',
    'QuickStack is a self-hosted platform for deploying Apps and Agents.',
    'Use this tool first to discover the operation id for the action you need,',
    'then call execute_operation. Operations mirror the QuickStack REST API.',
    'Use detail "full" only when you need the exact input and output schema.',
].join(' ');

const EXECUTE_TOOL_DESCRIPTION = [
    'Execute a QuickStack operation by its operation id.',
    'Call search_operations first to find a valid operation id and its schema.',
    'Map your arguments to pathParams, query and body according to the operation schema:',
    'pathParams fills :placeholders in the path, query becomes the query string, and',
    'body is the JSON request body for write operations.',
    'Responses follow the QuickStack REST API. Errors are returned as tool errors.',
].join(' ');

export type McpServerBuildOptions = {
    app: McpSourceApp;
    operations: OperationDescriptor[];
    authInfo?: AuthInfo;
};

class McpServerFactory {

    build(options: McpServerBuildOptions): McpServer {
        const server = new McpServer({ name: 'quickstack', version: '1.0.0' });
        this.registerSearchOperation(server, options.operations);
        this.registerExecuteOperation(server, options);
        return server;
    }

    private registerSearchOperation(server: McpServer, operations: OperationDescriptor[]): void {
        server.registerTool(
            'search_operations',
            {
                title: 'Search QuickStack operations',
                description: SEARCH_TOOL_DESCRIPTION,
                inputSchema: searchInputSchema,
                outputSchema: searchOutputSchema,
                annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
            },
            async ({ search, detail }) => {
                const term = search?.trim().toLowerCase() ?? '';
                const operationList = operations
                    .filter((operation) => this.matchesSearch(operation, term))
                    .map((operation) => this.serializeOperation(operation, detail));

                return {
                    content: [{ type: 'text' as const, text: JSON.stringify({ operations: operationList }) }],
                    structuredContent: { operations: operationList },
                };
            }
        );
    }

    private registerExecuteOperation(server: McpServer, options: McpServerBuildOptions): void {
        const { app, operations, authInfo } = options;

        server.registerTool(
            'execute_operation',
            {
                title: 'Execute QuickStack operation',
                description: EXECUTE_TOOL_DESCRIPTION,
                inputSchema: executeInputSchema,
                outputSchema: executeOutputSchema,
                annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
            },
            async ({ operationId, pathParams, query, body }) => {
                const operation = operations.find((candidate) => candidate.operationId === operationId);
                if (!operation) {
                    return this.errorResult(`Unknown operation "${operationId}". Call search_operations to find valid operation ids.`);
                }
                if (!operation.supported) {
                    return this.errorResult(`Operation "${operationId}" is not available over MCP. ${operation.unsupportedReason ?? ''}`.trim());
                }

                let execution;
                try {
                    execution = await operationExecutor.execute({
                        app,
                        operation,
                        pathParams: pathParams ?? {},
                        query: query ?? {},
                        body,
                        bearerToken: authInfo?.token,
                    });
                } catch (error) {
                    return this.errorResult(error instanceof Error ? error.message : 'Operation failed.');
                }

                if (execution.status >= 200 && execution.status < 300) {
                    const result = execution.result ?? null;
                    return {
                        content: [{ type: 'text' as const, text: JSON.stringify(result) }],
                        structuredContent: { status: execution.status, result },
                    };
                }

                return this.errorResult(this.describeFailure(execution.status, execution.result));
            }
        );
    }

    private serializeOperation(operation: OperationDescriptor, detail: 'name' | 'summary' | 'full') {
        const summary = {
            operationId: operation.operationId,
            method: operation.method,
            path: operation.path,
            tags: operation.tags,
            supported: operation.supported,
            ...(detail === 'name' ? {} : {
                summary: operation.summary,
                description: operation.description,
            }),
        };

        if (detail !== 'full') {
            return summary;
        }

        return {
            ...summary,
            pathParamsSchema: operation.pathParamsSchema,
            querySchema: operation.querySchema,
            bodySchema: operation.bodySchema,
            responseSchema: operation.responseSchema,
            unsupportedReason: operation.unsupportedReason,
        };
    }

    private matchesSearch(operation: OperationDescriptor, term: string): boolean {
        if (!term) {
            return true;
        }
        const haystack = [
            operation.operationId,
            operation.summary,
            operation.description,
            ...operation.tags,
        ].filter((value): value is string => !!value);
        return haystack.some((value) => value.toLowerCase().includes(term));
    }

    private errorResult(text: string) {
        return { isError: true as const, content: [{ type: 'text' as const, text }] };
    }

    private describeFailure(status: number, result: unknown): string {
        if (result && typeof result === 'object') {
            const problem = result as { detail?: unknown; title?: unknown };
            const message = typeof problem.detail === 'string' ? problem.detail : problem.title;
            if (typeof message === 'string') {
                return `QuickStack returned HTTP ${status}: ${message}`;
            }
        }
        return `QuickStack returned HTTP ${status}.`;
    }
}

const mcpServerFactory = new McpServerFactory();
export default mcpServerFactory;
