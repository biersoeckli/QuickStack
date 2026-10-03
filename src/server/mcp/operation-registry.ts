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
};

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

function toJsonSchema(schema: unknown): Record<string, unknown> | undefined {
    if (!schema || typeof schema !== 'object' || !('~standard' in schema)) {
        return undefined;
    }

    try {
        return toJsonSchemaUnsafe(schema);
    } catch {
        return undefined;
    }
}

function toJsonSchemaUnsafe(schema: unknown): Record<string, unknown> {
    return z.toJSONSchema(schema as z.ZodType, { unrepresentable: 'any' }) as Record<string, unknown>;
}

export function buildOperationRegistry(app: McpSourceApp): OperationDescriptor[] {
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

        if (!responseSchema) {
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
            pathParamsSchema: toJsonSchema(route.hooks?.params),
            querySchema: toJsonSchema(route.hooks?.query),
            bodySchema: toJsonSchema(route.hooks?.body),
            responseSchema: toJsonSchema(responseSchema),
            supported,
            unsupportedReason,
        });
    }

    return descriptors.sort((left, right) => left.operationId.localeCompare(right.operationId));
}
