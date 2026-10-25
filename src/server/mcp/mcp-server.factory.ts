import { McpServer } from '@modelcontextprotocol/server';
import type { AuthInfo } from '@modelcontextprotocol/server';
import { z } from 'zod';
import packageJson from '../../../package.json';
import operationExecutor from './operation-executor';
import type { McpSourceApp, OperationDescriptor } from './operation-registry';

export const MCP_TOOL_NAMES = {
    search: 'quickstack_search_operations',
    read: 'quickstack_execute_read_operation',
    write: 'quickstack_execute_operation',
} as const;

const SEARCH_TOOL = MCP_TOOL_NAMES.search;
const READ_TOOL = MCP_TOOL_NAMES.read;
const WRITE_TOOL = MCP_TOOL_NAMES.write;

const SERVER_NAME = 'quickstack';
const SERVER_VERSION = packageJson.version;

const DEFAULT_SEARCH_LIMIT = 25;
const MAX_SEARCH_LIMIT = 100;

/** Keeps one tool result well below Anthropic's 25k-token tool-response ceiling. */
const MAX_OPERATION_RESULT_CHARS = 48_000;
const MAX_ERROR_CHARS = 4_000;

const SEARCH_STOPWORDS = new Set([
    'a', 'an', 'and', 'are', 'can', 'could', 'do', 'does', 'for', 'from', 'how',
    'i', 'in', 'is', 'it', 'me', 'my', 'of', 'on', 'or', 'please', 'show', 'the',
    'to', 'what', 'which', 'with', 'would', 'you',
]);

const searchInputSchema = z.object({
    search: z.string().optional().describe('Free-text match. Words are combined with AND against operation id, summary, description and tags.'),
    detail: z.enum(['name', 'summary', 'full']).optional().default('summary').describe('How much of each operation to return. "full" requires a search term.'),
    limit: z.number().int().min(1).max(MAX_SEARCH_LIMIT).optional().default(DEFAULT_SEARCH_LIMIT).describe('Maximum number of matching operations to return.'),
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
    total: z.number().int(),
    returned: z.number().int(),
    hint: z.string().optional(),
});

const readInputSchema = z.object({
    operationId: z.string().describe(`Operation id returned by ${SEARCH_TOOL}.`),
    pathParams: z.record(z.string(), z.unknown()).optional().default({}).describe('Values for the :placeholders in the operation path.'),
    query: z.record(z.string(), z.unknown()).optional().default({}).describe('Query string parameters. List operations accept limit and cursor.'),
});

const writeInputSchema = readInputSchema.extend({
    body: z.unknown().optional().describe('JSON request body for write operations. Inspect bodySchema first.'),
});

const executeOutputSchema = z.object({
    status: z.number().int(),
    result: z.unknown(),
    truncated: z.boolean().optional(),
    originalCharacters: z.number().int().optional(),
    hint: z.string().optional(),
});

const SERVER_INSTRUCTIONS = [
    'QuickStack is a self-hosted platform for deploying Apps and Agents on Kubernetes.',
    `Workflow: call ${SEARCH_TOOL} to find the operation id, call it again with detail "full" to read the exact input schema, then run the operation with ${READ_TOOL} or ${WRITE_TOOL}.`,
    `Only pass a readOnly operation to ${READ_TOOL}. Use ${WRITE_TOOL} for deploys, deletes, saves and commands.`,
    `Before calling ${WRITE_TOOL}, summarize the intended change and ask the user for confirmation. Never chain destructive writes without explicit approval.`,
    'deployApp returns a deploymentId immediately; poll listAppDeployments or getAppDeployment until it reports success or failure. deployAgent applies CONTAINER configs synchronously; GIT builds continue asynchronously in the QuickStack UI, so poll listAgentSandboxes before starting a sandbox.',
    'Tool responses are truncated when they exceed the size limit. Narrow the request with search filters, list limit/cursor or a smaller lines value.',
].join(' ');

const SEARCH_TOOL_DESCRIPTION = [
    'Search the QuickStack operations catalog.',
    'QuickStack is a self-hosted platform for deploying Apps and Agents.',
    'Use this tool first to discover the operation id for the action you need.',
    'Always start with detail "summary" to see the operation list, then repeat the search with detail "full" for the one operation whose schema you need.',
    'Each operation reports readOnly and the tool to call:',
    `${READ_TOOL} for read-only operations and ${WRITE_TOOL} for mutating operations.`,
    'Search words are combined with AND. Prefer concrete terms such as "deploy app", "app logs" or "agent sandbox".',
].join(' ');

const READ_TOOL_DESCRIPTION = [
    'Execute a read-only QuickStack operation.',
    `Call ${SEARCH_TOOL} first and pass an operationId whose readOnly field is true.`,
    'Map your arguments to pathParams and query according to the operation schema.',
    'Read operations never change QuickStack state and need no confirmation.',
].join(' ');

const WRITE_TOOL_DESCRIPTION = [
    'Execute a mutating QuickStack operation, such as create, update, delete, deploy or run a command.',
    `Workflow: call ${SEARCH_TOOL} with detail "full" for the operationId, map your arguments to pathParams, query and body, then call this tool.`,
    'The operation description contains request examples for each write operation.',
    'This tool changes QuickStack state: summarize the change and ask the user for confirmation before calling it.',
].join(' ');

type OperationArguments = {
    operationId: string;
    pathParams?: Record<string, unknown>;
    query?: Record<string, unknown>;
    body?: unknown;
};

type RankedOperation = {
    operation: OperationDescriptor;
    score: number;
};

export type McpServerBuildOptions = {
    app: McpSourceApp;
    operations: OperationDescriptor[];
    authInfo?: AuthInfo;
    version?: string;
};

class McpServerFactory {

    build(options: McpServerBuildOptions): McpServer {
        const server = new McpServer(
            { name: SERVER_NAME, version: options.version ?? SERVER_VERSION },
            { instructions: SERVER_INSTRUCTIONS }
        );
        this.registerSearchOperation(server, options.operations);
        this.registerReadOperation(server, options);
        this.registerWriteOperation(server, options);
        return server;
    }

    private registerSearchOperation(server: McpServer, operations: OperationDescriptor[]): void {
        server.registerTool(
            SEARCH_TOOL,
            {
                title: 'Search QuickStack operations',
                description: SEARCH_TOOL_DESCRIPTION,
                inputSchema: searchInputSchema,
                outputSchema: searchOutputSchema,
                annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
            },
            async ({ search, detail, limit }) => {
                const trimmedSearch = search?.trim() ?? '';
                if (detail === 'full' && !trimmedSearch) {
                    return this.errorResult(
                        `detail "full" requires a search term. Call ${SEARCH_TOOL} with search and detail "full" for the operation you need.`
                    );
                }

                const ranked = this.rankOperations(operations, trimmedSearch);
                const page = ranked.slice(0, limit);
                const operationList = page.map((entry) => this.serializeOperation(entry.operation, detail));
                const hint = ranked.length > page.length
                    ? `Showing ${page.length} of ${ranked.length} matches. Refine the search or raise limit (max ${MAX_SEARCH_LIMIT}).`
                    : undefined;

                return {
                    content: [{ type: 'text' as const, text: JSON.stringify({ operations: operationList, total: ranked.length, returned: operationList.length, hint }) }],
                    structuredContent: {
                        operations: operationList,
                        total: ranked.length,
                        returned: operationList.length,
                        hint,
                    },
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
            return this.errorResult(`Unknown operation "${args.operationId}". Call ${SEARCH_TOOL} to find valid operation ids.`);
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
            return this.successResult(operation, execution.status, execution.result ?? null);
        }

        return this.errorResult(this.describeFailure(execution.status, execution.result));
    }

    private successResult(operation: OperationDescriptor, status: number, result: unknown) {
        const serialized = JSON.stringify(result);
        if (serialized.length <= MAX_OPERATION_RESULT_CHARS) {
            return {
                content: [{ type: 'text' as const, text: serialized }],
                structuredContent: { status, result },
            };
        }

        const hint = this.buildTruncationHint(operation);
        const preview = serialized.slice(0, MAX_OPERATION_RESULT_CHARS);
        return {
            content: [{
                type: 'text' as const,
                text: `${preview}\n\n[Response truncated: ${serialized.length} characters total, showing the first ${MAX_OPERATION_RESULT_CHARS}. ${hint}]`,
            }],
            structuredContent: {
                status,
                result: preview,
                truncated: true,
                originalCharacters: serialized.length,
                hint,
            },
        };
    }

    private buildTruncationHint(operation: OperationDescriptor): string {
        const queryProperties = this.schemaProperties(operation.querySchema);
        if (queryProperties.includes('lines')) {
            return 'Retry with a smaller query.lines value to fetch fewer log lines.';
        }
        if (queryProperties.includes('tailLines')) {
            return 'Retry with a smaller query.tailLines value to fetch fewer log lines.';
        }
        if (queryProperties.includes('limit') || queryProperties.includes('cursor')) {
            return 'Retry with query.limit and, if present in the response, query.cursor to page through the result.';
        }
        return 'Narrow the request with filters or fetch a single resource instead of a large collection.';
    }

    private schemaProperties(schema: Record<string, unknown> | undefined): string[] {
        if (!schema || typeof schema !== 'object') {
            return [];
        }
        const properties = (schema as { properties?: unknown }).properties;
        if (!properties || typeof properties !== 'object') {
            return [];
        }
        return Object.keys(properties as Record<string, unknown>);
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

    private rankOperations(operations: OperationDescriptor[], search: string): RankedOperation[] {
        if (!search) {
            return operations.map((operation) => ({ operation, score: 0 }));
        }

        const query = search.toLowerCase();
        const tokens = this.tokenizeSearch(query);
        const ranked: RankedOperation[] = [];

        for (const operation of operations) {
            const score = this.scoreOperation(operation, query, tokens);
            if (score >= 0) {
                ranked.push({ operation, score });
            }
        }

        return ranked.sort((left, right) =>
            right.score - left.score || left.operation.operationId.localeCompare(right.operation.operationId)
        );
    }

    private tokenizeSearch(query: string): string[] {
        return query
            .split(/[^a-z0-9]+/)
            .filter((token) => token.length > 1 && !SEARCH_STOPWORDS.has(token));
    }

    private scoreOperation(operation: OperationDescriptor, query: string, tokens: string[]): number {
        const operationId = operation.operationId.toLowerCase();
        const summary = (operation.summary ?? '').toLowerCase();
        const description = (operation.description ?? '').toLowerCase();
        const tags = operation.tags.map((tag) => tag.toLowerCase());

        let score = 0;
        for (const token of tokens) {
            let tokenScore = 0;
            if (operationId === token) {
                tokenScore += 100;
            } else if (operationId.includes(token)) {
                tokenScore += 25;
            }
            if (tags.some((tag) => tag === token)) {
                tokenScore += 20;
            } else if (tags.some((tag) => tag.includes(token))) {
                tokenScore += 10;
            }
            if (summary.includes(token)) {
                tokenScore += 5;
            }
            if (description.includes(token)) {
                tokenScore += 2;
            }
            if (tokenScore === 0) {
                return -1;
            }
            score += tokenScore;
        }

        if (operationId === query) {
            score += 200;
        } else if (operationId.startsWith(query)) {
            score += 50;
        }
        return score;
    }

    private errorResult(text: string) {
        const bounded = text.length > MAX_ERROR_CHARS
            ? `${text.slice(0, MAX_ERROR_CHARS)}\n[Error message truncated]`
            : text;
        return { isError: true as const, content: [{ type: 'text' as const, text: bounded }] };
    }

    private describeFailure(status: number, result: unknown): string {
        if (result && typeof result === 'object') {
            const problem = result as Record<string, unknown>;
            const parts: string[] = [];

            if (typeof problem.detail === 'string' && problem.detail.trim()) {
                parts.push(problem.detail);
            } else if (typeof problem.title === 'string' && problem.title.trim()) {
                parts.push(problem.title);
            }

            for (const key of ['errors', 'issues']) {
                const entries = problem[key];
                if (!Array.isArray(entries)) {
                    continue;
                }
                const formatted = entries
                    .map((entry) => this.formatValidationEntry(entry))
                    .filter((entry): entry is string => Boolean(entry));
                if (formatted.length > 0) {
                    parts.push(formatted.join('; '));
                }
            }

            if (parts.length > 0) {
                return `QuickStack returned HTTP ${status}: ${parts.join(' - ')}`;
            }
        }

        if (typeof result === 'string' && result.trim()) {
            return `QuickStack returned HTTP ${status}: ${result.trim()}`;
        }

        return `QuickStack returned HTTP ${status}.`;
    }

    private formatValidationEntry(entry: unknown): string | undefined {
        if (typeof entry === 'string') {
            return entry;
        }
        if (!entry || typeof entry !== 'object') {
            return undefined;
        }

        const record = entry as Record<string, unknown>;
        const message = typeof record.message === 'string'
            ? record.message
            : typeof record.detail === 'string'
                ? record.detail
                : undefined;
        const path = record.path;

        if (Array.isArray(path)) {
            return `${path.join('.') || '(root)'}: ${message ?? 'invalid value'}`;
        }
        if (typeof path === 'string') {
            return `${path}: ${message ?? 'invalid value'}`;
        }
        return message;
    }
}

const mcpServerFactory = new McpServerFactory();
export default mcpServerFactory;
