import { z } from 'zod';
import { ApiNotFoundException, ApiUnauthorizedException, ServiceException } from '@/shared/model/service.exception.model';
import { getIdentityFromApiKeyHeader } from './requester-identity.utils';

const problemResponseSchema = z.object({
    type: z.string(),
    title: z.string(),
    status: z.number(),
    detail: z.string().optional(),
});

export class ApiUtils {

    static toJsonSchema<T>(schema: z.ZodType<T>) {
        return z.toJSONSchema(schema, {
            unrepresentable: 'any',
            override(ctx) {
                if (ctx.zodSchema instanceof z.ZodDate) {
                    ctx.jsonSchema.type = 'string';
                    ctx.jsonSchema.format = 'date-time';
                }
            }
        });
    }

    static async deriveFunc({ request, path }: { request: Request, path: string }) {
        const isPublicOpenApiPath = path === '/api/v1/openapi' || path === '/api/v1/openapi.json';
        if (isPublicOpenApiPath) {
            return { identity: null };
        }

        const identity = await getIdentityFromApiKeyHeader(request.headers.get('authorization'));
        if (!identity) {
            throw new Response(JSON.stringify({ type: 'about:blank', title: 'Unauthorized', status: 401 }), {
                status: 401,
                headers: { 'content-type': 'application/problem+json' }
            });
        }

        return { identity };
    };

    static problem(status: number, title: string, detail?: string): Response {
        return new Response(JSON.stringify({
            type: 'about:blank',
            title,
            status,
            ...(detail ? { detail } : {})
        }), {
            status,
            headers: { 'content-type': 'application/problem+json' }
        });
    }

    static mapError(error: unknown): Response {
        if (error instanceof z.ZodError) {
            return ApiUtils.problem(400, 'Bad Request', 'Request validation failed. ' + error.issues.map(e => `${e.path.join('.')} - ${e.message}`).join('; '));
        }
        if (error instanceof ServiceException) {
            return ApiUtils.problem(400, 'Bad Request', error.message);
        }
        if (error instanceof ApiUnauthorizedException) {
            return ApiUtils.problem(error.statusCode, error.title, error.message);
        }
        if (error instanceof ApiNotFoundException) {
            return ApiUtils.problem(error.statusCode, error.title, error.message);
        }
        console.error(error);
        return ApiUtils.problem(500, 'Internal Server Error', 'An unknown error occurred.');
    }

    static mapReponseModel<T>(schema: z.ZodType<T>) {
        return {
            200: schema,
            401: problemResponseSchema,
            404: problemResponseSchema,
            500: problemResponseSchema,
        };
    }
}
