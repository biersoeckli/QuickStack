import { McpServer } from '@modelcontextprotocol/server';
import type { AuthInfo } from '@modelcontextprotocol/server';
import { z } from 'zod';
import operationExecutor from './operation-executor';
import type { McpSourceApp, OperationDescriptor } from './operation-registry';

const READ_TOOL = 'execute_read_operation';
const WRITE_TOOL = 'execute_operation';

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
    readOnly: z.boolean(),
    tool: z.enum([READ_TOOL, WRITE_TOOL]),
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

const readInputSchema = z.object({
    operationId: z.string().describe('Operation id returned by search_operations.'),
    pathParams: z.record(z.string(), z.unknown()).optional().default({}).describe('Values for the :placeholders in the operation path.'),
    query: z.record(z.string(), z.unknown()).optional().default({}).describe('Query string parameters.'),
});

const writeInputSchema = readInputSchema.extend({
    body: z.unknown().optional().describe('JSON request body for write operations.'),
});

const executeOutputSchema = z.object({
    status: z.number().int(),
    result: z.unknown(),
});

const SEARCH_TOOL_DESCRIPTION = [
    'Search the QuickStack operations catalog.',
    'QuickStack is a self-hosted platform for deploying Apps and Agents.',
    'Use this tool first to discover the operation id for the action you need.',
    'Each operation reports readOnly and the tool to call:',
    `${READ_TOOL} for read-only operations and ${WRITE_TOOL} for mutating operations.`,
    'Use detail "full" only when you need the exact input and output schema.',
].join(' ');

const READ_TOOL_DESCRIPTION = [
    'Execute a read-only QuickStack operation.',
    'Call search_operations first and pass an operationId whose readOnly field is true.',
    'Map your arguments to pathParams and query according to the operation schema.',
    'Read operations never change QuickStack state and need no confirmation.',
].join(' ');

const WRITE_TOOL_DESCRIPTION = [
    'Execute a mutating QuickStack operation, such as create, update, delete, deploy or run a command.',
    'Call search_operations first and pass an operationId whose readOnly field is false.',
    'Map your arguments to pathParams, query and body according to the operation schema.',
    'This tool changes QuickStack state: ask the user for confirmation before calling it.',
].join(' ');

type OperationArguments = {
    operationId: string;
    pathParams?: Record<string, unknown>;
    query?: Record<string, unknown>;
    body?: unknown;
};

export type McpServerBuildOptions = {
    app: McpSourceApp;
    operations: OperationDescriptor[];
    authInfo?: AuthInfo;
};

class McpServerFactory {

    build(options: McpServerBuildOptions): McpServer {
        const server = new McpServer({ name: 'quickstack', version: '1.0.0' });
        this.registerSearchOperation(server, options.operations);
        this.registerReadOperation(server, options);
        this.registerWriteOperation(server, options);
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

    private registerReadOperation(server: McpServer, options: McpServerBuildOptions): void {
        server.registerTool(
            READ_TOOL,
            {
                title: 'Execute read-only QuickStack operation',
                description: READ_TOOL_DESCRIPTION,
                inputSchema: readInputSchema,
                outputSchema: executeOutputSchema,
                annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
            },
            async ({ operationId, pathParams, query }) => this.runOperation(
                options,
                { operationId, pathParams, query },
                true
            )
        );
    }

    private registerWriteOperation(server: McpServer, options: McpServerBuildOptions): void {
        server.registerTool(
            WRITE_TOOL,
            {
                title: 'Execute mutating QuickStack operation',
                description: WRITE_TOOL_DESCRIPTION,
                inputSchema: writeInputSchema,
                outputSchema: executeOutputSchema,
                annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
            },
            async ({ operationId, pathParams, query, body }) => this.runOperation(
                options,
                { operationId, pathParams, query, body },
                false
            )
        );
    }

    private async runOperation(options: McpServerBuildOptions, args: OperationArguments, expectReadOnly: boolean) {
        const { app, operations, authInfo } = options;
        const operation = operations.find((candidate) => candidate.operationId === args.operationId);

        if (!operation) {
            return this.errorResult(`Unknown operation "${args.operationId}". Call search_operations to find valid operation ids.`);
        }
        if (!operation.supported) {
            return this.errorResult(`Operation "${args.operationId}" is not available over MCP. ${operation.unsupportedReason ?? ''}`.trim());
        }
        if (operation.readOnly !== expectReadOnly) {
            const tool = operation.readOnly ? READ_TOOL : WRITE_TOOL;
            return this.errorResult(`Operation "${args.operationId}" is ${operation.readOnly ? 'read-only' : 'mutating'}. Call ${tool} instead.`);
        }

        let execution;
        try {
            execution = await operationExecutor.execute({
                app,
                operation,
                pathParams: args.pathParams ?? {},
                query: args.query ?? {},
                body: args.body,
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

    private serializeOperation(operation: OperationDescriptor, detail: 'name' | 'summary' | 'full') {
        const summary = {
            operationId: operation.operationId,
            method: operation.method,
            path: operation.path,
            tags: operation.tags,
            supported: operation.supported,
            readOnly: operation.readOnly,
            tool: operation.readOnly ? READ_TOOL : WRITE_TOOL,
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
        ].filter((value): value is string => Boolean(value));
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
