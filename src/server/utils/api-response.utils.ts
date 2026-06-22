import { z } from 'zod';
import { ApiNotFoundException, ApiUnauthorizedException, ServiceException } from '@/shared/model/service.exception.model';
import { stringToDate } from '@/shared/utils/zod.utils';
import { getIdentityFromApiKeyHeader } from './requester-identity.utils';
import paramService, { ParamService } from '../services/param.service';

const problemResponseSchema = z.object({
    type: z.string(),
    title: z.string(),
    status: z.number(),
    detail: z.string().optional(),
});

export class ApiUtils {

    private static mapDateSchemaToStringDate(schema: any): z.ZodTypeAny {
        if (schema instanceof z.ZodDate) {
            return stringToDate;
        }

        if (schema instanceof z.ZodObject) {
            const mappedShape = Object.fromEntries(
                Object.entries(schema.shape).map(([key, value]) => [key, ApiUtils.mapDateSchemaToStringDate(value)])
            );

            let mappedObject = z.object(mappedShape);
            const catchall = schema._def.catchall as any;

            if (catchall instanceof z.ZodNever) {
                mappedObject = mappedObject.strict();
            } else if (catchall instanceof z.ZodUnknown) {
                mappedObject = mappedObject.passthrough();
            } else if (catchall) {
                mappedObject = mappedObject.catchall(ApiUtils.mapDateSchemaToStringDate(catchall));
            }

            return mappedObject;
        }

        if (schema instanceof z.ZodArray) {
            return z.array(ApiUtils.mapDateSchemaToStringDate(schema.element));
        }

        if (schema instanceof z.ZodOptional) {
            return ApiUtils.mapDateSchemaToStringDate(schema.unwrap()).optional();
        }

        if (schema instanceof z.ZodNullable) {
            return ApiUtils.mapDateSchemaToStringDate(schema.unwrap()).nullable();
        }

        if (schema instanceof z.ZodDefault) {
            return ApiUtils.mapDateSchemaToStringDate(schema._def.innerType).default(schema._def.defaultValue);
        }

        if (schema instanceof z.ZodUnion) {
            return z.union((schema._def.options as any[]).map(option => ApiUtils.mapDateSchemaToStringDate(option)) as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]);
        }

        if (schema instanceof z.ZodTuple) {
            const mappedItems = (schema._def.items as any[]).map(item => ApiUtils.mapDateSchemaToStringDate(item)) as [z.ZodTypeAny, ...z.ZodTypeAny[]];
            const mappedTuple = z.tuple(mappedItems);

            return schema._def.rest ? mappedTuple.rest(ApiUtils.mapDateSchemaToStringDate(schema._def.rest)) : mappedTuple;
        }

        if (schema instanceof z.ZodRecord) {
            return z.record(
                schema._def.keyType as z.ZodString | z.ZodNumber | z.ZodSymbol,
                ApiUtils.mapDateSchemaToStringDate(schema._def.valueType as any)
            );
        }

        if (schema instanceof z.ZodLazy) {
            return z.lazy(() => ApiUtils.mapDateSchemaToStringDate(schema._def.getter() as any));
        }

        if (schema instanceof z.ZodPromise) {
            return z.promise(ApiUtils.mapDateSchemaToStringDate(schema.unwrap() as any));
        }

        return schema;
    }

    static toJsonSchema<T>(schema: z.ZodType<T>) {
        return z.toJSONSchema(schema, {
            unrepresentable: 'any',
            override(ctx) {
                if (ctx.zodSchema instanceof z.ZodDate) {
                    ctx.jsonSchema.type = 'string';
                    ctx.jsonSchema.format = 'date-time';
                }
                if (ctx.zodSchema === stringToDate) {
                    ctx.jsonSchema.type = 'string';
                    ctx.jsonSchema.format = 'date-time';
                }
            }
        });
    }

    static async deriveFunc({ request, path }: { request: Request, path: string }) {
        const isPublicOpenApiPath = await paramService.getBoolean(ParamService.API_OPEN_API_SPEC_ENABLED) && (path === '/api/v1/openapi' || path === '/api/v1/openapi.json');
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
            200: ApiUtils.mapDateSchemaToStringDate(schema) as z.ZodType<T>,
            401: problemResponseSchema,
            404: problemResponseSchema,
            500: problemResponseSchema,
        };
    }
}
