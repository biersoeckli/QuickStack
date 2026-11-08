import { z } from 'zod';
import { ValidationError } from 'elysia';
import { ApiException, ServiceException } from '@/shared/model/service.exception.model';
import { stringToDate } from '@/shared/utils/zod.utils';
import { getIdentityFromApiKeyHeader } from './requester-identity.utils';
import paramService, { ParamService } from '../services/param.service';

const problemResponseSchema = z.object({
    type: z.string(),
    title: z.string(),
    status: z.number(),
    detail: z.string().optional(),
    errors: z.array(z.object({
        path: z.string(),
        message: z.string(),
    })).optional(),
});

type ProblemFieldError = {
    path: string;
    message: string;
};

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
            const catchall = schema._def.catchall;

            if (catchall instanceof z.ZodNever) {
                mappedObject = mappedObject.strict();
            } else if (catchall instanceof z.ZodUnknown) {
                mappedObject = mappedObject.passthrough();
            } else if (catchall) {
                mappedObject = mappedObject.catchall(ApiUtils.mapDateSchemaToStringDate(catchall));
            }

            return ApiUtils.withMeta(schema, mappedObject);
        }

        if (schema instanceof z.ZodArray) {
            return ApiUtils.withMeta(schema, z.array(ApiUtils.mapDateSchemaToStringDate(schema.element)));
        }

        if (schema instanceof z.ZodOptional) {
            return ApiUtils.withMeta(schema, ApiUtils.mapDateSchemaToStringDate(schema.unwrap()).optional());
        }

        if (schema instanceof z.ZodNullable) {
            return ApiUtils.withMeta(schema, ApiUtils.mapDateSchemaToStringDate(schema.unwrap()).nullable());
        }

        if (schema instanceof z.ZodDefault) {
            return ApiUtils.withMeta(schema, ApiUtils.mapDateSchemaToStringDate(schema._def.innerType).default(schema._def.defaultValue));
        }

        if (schema instanceof z.ZodUnion) {
            return ApiUtils.withMeta(schema, z.union((schema._def.options).map(option => ApiUtils.mapDateSchemaToStringDate(option)) as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]));
        }

        if (schema instanceof z.ZodTuple) {
            const mappedItems = (schema._def.items).map(item => ApiUtils.mapDateSchemaToStringDate(item)) as [z.ZodTypeAny, ...z.ZodTypeAny[]];
            const mappedTuple = z.tuple(mappedItems);

            return ApiUtils.withMeta(schema, schema._def.rest ? mappedTuple.rest(ApiUtils.mapDateSchemaToStringDate(schema._def.rest)) : mappedTuple);
        }

        if (schema instanceof z.ZodRecord) {
            return ApiUtils.withMeta(schema, z.record(
                schema._def.keyType as z.ZodString | z.ZodNumber | z.ZodSymbol,
                ApiUtils.mapDateSchemaToStringDate(schema._def.valueType)
            ));
        }

        if (schema instanceof z.ZodLazy) {
            return ApiUtils.withMeta(schema, z.lazy(() => ApiUtils.mapDateSchemaToStringDate(schema._def.getter())));
        }

        if (schema instanceof z.ZodPromise) {
            return ApiUtils.withMeta(schema, z.promise(ApiUtils.mapDateSchemaToStringDate(schema.unwrap())));
        }

        return schema;
    }

    /** Preserves `.meta()` when the date mapper has to rebuild a schema wrapper. */
    private static withMeta<T extends z.ZodTypeAny>(source: z.ZodTypeAny, target: T): T {
        const meta = z.globalRegistry.get(source);
        if (!meta) {
            return target;
        }
        return target.meta(meta) as T;
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

    static problem(status: number, title: string, detail?: string, errors?: ProblemFieldError[]): Response {
        return new Response(JSON.stringify({
            type: 'about:blank',
            title,
            status,
            ...(detail ? { detail } : {}),
            ...(errors && errors.length > 0 ? { errors } : {}),
        }), {
            status,
            headers: { 'content-type': 'application/problem+json' }
        });
    }

    static mapError(error: unknown): Response {
        if (error instanceof ValidationError) {
            const errors = this.toFieldErrors(error);
            const detail = errors.length > 0
                ? `Request validation failed: ${errors.map(entry => `${entry.path || '(root)'} - ${entry.message}`).join('; ')}`
                : 'Request validation failed.';
            return ApiUtils.problem(422, 'Unprocessable Entity', detail, errors);
        }
        if (error instanceof z.ZodError) {
            const errors = error.issues.map(issue => ({
                path: issue.path.join('.'),
                message: issue.message,
            }));
            return ApiUtils.problem(400, 'Bad Request', 'Request validation failed. ' + errors.map(entry => `${entry.path} - ${entry.message}`).join('; '), errors);
        }
        if (error instanceof ServiceException) {
            return ApiUtils.problem(400, 'Bad Request', error.message);
        }
        if (error instanceof ApiException) {
            return ApiUtils.problem(error.statusCode, error.title, error.message);
        }
        console.error(error);
        return ApiUtils.problem(500, 'Internal Server Error', 'An unknown error occurred.');
    }

    private static toFieldErrors(error: ValidationError): ProblemFieldError[] {
        try {
            return error.all.map((issue) => ({
                path: this.normalizeFieldPath(issue.path),
                message: issue.message || 'Invalid value.',
            }));
        } catch {
            return [];
        }
    }

    private static normalizeFieldPath(path: string | undefined): string {
        if (!path) {
            return '';
        }
        return path.replace(/^\//, '').replace(/\//g, '.');
    }

    static mapResponseModel<T>(schema: z.ZodType<T>) {
        return {
            200: ApiUtils.mapDateSchemaToStringDate(schema) as z.ZodType<T>,
            401: problemResponseSchema,
            404: problemResponseSchema,
            409: problemResponseSchema,
            422: problemResponseSchema,
            500: problemResponseSchema,
        };
    }
}
