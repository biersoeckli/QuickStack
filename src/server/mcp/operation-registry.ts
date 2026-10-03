import { z } from 'zod';

export type McpSourceApp = {
    routes: unknown[];
    handle: (request: Request) => Promise<Response>;
};

export type OperationDescriptor = {
    operationId: string;
    method: string;
    path: string;
    summary?: string;
    description?: string;
    tags: string[];
    pathParamsSchema?: Record<string, unknown>;
    querySchema?: Record<string, unknown>;
    bodySchema?: Record<string, unknown>;
    responseSchema?: Record<string, unknown>;
    supported: boolean;
    unsupportedReason?: string;
    readOnly: boolean;
};

function isReadOnlyMethod(method: string): boolean {
    return method === 'GET' || method === 'HEAD';
}

type ElysiaRoute = {
    method: string;
    path: string;
    hooks?: {
        params?: unknown;
        query?: unknown;
        body?: unknown;
        response?: Record<string, unknown>;
        parse?: Array<{ fn?: string }>;
        detail?: {
            operationId?: string;
            summary?: string;
            description?: string;
            tags?: string[];
        };
    };
};

class OperationRegistry {

    private operationExclusionList = new Set([
        'writeAgentSandboxFile',
    ]);

    build(app: McpSourceApp): OperationDescriptor[] {
        const routes = (app.routes ?? []) as ElysiaRoute[];
        const seen = new Set<string>();
        const descriptors: OperationDescriptor[] = [];

        for (const route of routes) {
            const detail = route.hooks?.detail;
            const operationId = detail?.operationId;
            if (!operationId || seen.has(operationId)) {
                continue;
            }
            seen.add(operationId);

            const responseSchema = route.hooks?.response?.['200'];
            const manualBodyParsing = (route.hooks?.parse ?? []).some((entry) => entry?.fn === 'none');

            let supported = true;
            let unsupportedReason: string | undefined;

            if (this.operationExclusionList.has(operationId)) {
                supported = false;
                unsupportedReason = 'Operation is excluded from MCP.';
            } else if (!responseSchema) {
                supported = false;
                unsupportedReason = 'Operation does not declare a JSON response.';
            } else if (manualBodyParsing) {
                supported = false;
                unsupportedReason = 'Operation consumes a non-JSON request body.';
            }

            descriptors.push({
                operationId,
                method: route.method,
                path: route.path,
                summary: detail?.summary,
                description: detail?.description,
                tags: detail?.tags ?? [],
                pathParamsSchema: this.toJsonSchema(route.hooks?.params),
                querySchema: this.toJsonSchema(route.hooks?.query),
                bodySchema: this.toJsonSchema(route.hooks?.body),
                responseSchema: this.toJsonSchema(responseSchema),
                supported,
                unsupportedReason,
                readOnly: isReadOnlyMethod(route.method),
            });
        }

        return descriptors.sort((left, right) => left.operationId < right.operationId ? -1 : left.operationId > right.operationId ? 1 : 0);
    }

    private toJsonSchema(schema: unknown): Record<string, unknown> | undefined {
        if (!schema || typeof schema !== 'object' || !('~standard' in schema)) {
            return undefined;
        }

        try {
            return z.toJSONSchema(schema as z.ZodType, { unrepresentable: 'any' }) as Record<string, unknown>;
        } catch {
            return undefined;
        }
    }
}

const operationRegistry = new OperationRegistry();
export default operationRegistry;
