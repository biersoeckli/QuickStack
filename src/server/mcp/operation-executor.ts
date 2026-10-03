import type { McpSourceApp, OperationDescriptor } from './operation-registry';

export type OperationExecutionResult = {
    status: number;
    result: unknown;
};

const PATH_PARAM_PATTERN = /:([A-Za-z0-9_]+)/g;

export function resolveOperationPath(template: string, pathParams: Record<string, unknown>): string {
    return template.replace(PATH_PARAM_PATTERN, (_match, name: string) => {
        const value = pathParams[name];
        if (value === undefined || value === null || value === '') {
            throw new Error(`Missing required path parameter "${name}".`);
        }
        return encodeURIComponent(String(value));
    });
}

export async function executeOperation(options: {
    app: McpSourceApp;
    operation: OperationDescriptor;
    pathParams: Record<string, unknown>;
    query: Record<string, unknown>;
    body: unknown;
    bearerToken?: string;
}): Promise<OperationExecutionResult> {
    const { app, operation, pathParams, query, body, bearerToken } = options;
    const path = resolveOperationPath(operation.path, pathParams);
    const url = new URL(path, 'http://quickstack.local');

    for (const [key, value] of Object.entries(query ?? {})) {
        if (value === undefined || value === null) {
            continue;
        }
        if (Array.isArray(value)) {
            for (const item of value) {
                url.searchParams.append(key, String(item));
            }
        } else {
            url.searchParams.set(key, String(value));
        }
    }

    const headers = new Headers();
    if (bearerToken) {
        headers.set('authorization', `Bearer ${bearerToken}`);
    }

    let requestBody: string | undefined;
    if (body !== undefined && operation.method !== 'GET' && operation.method !== 'DELETE') {
        headers.set('content-type', 'application/json');
        requestBody = JSON.stringify(body);
    }

    const response = await app.handle(new Request(url, {
        method: operation.method,
        headers,
        body: requestBody,
    }));

    const text = await response.text();
    let result: unknown = undefined;
    if (text) {
        try {
            result = JSON.parse(text);
        } catch {
            result = text;
        }
    }

    return { status: response.status, result };
}
