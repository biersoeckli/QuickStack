import { z } from 'zod';
import { ServiceException } from '@/shared/model/service.exception.model';

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;

export const paginationQueryZodModel = z.object({
    limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional()
        .describe(`Maximum number of items to return (1-${MAX_PAGE_SIZE}).`),
    cursor: z.string().optional()
        .describe('Opaque continuation cursor from a previous response. Send it together with limit.'),
});

export type PaginationQuery = z.infer<typeof paginationQueryZodModel>;

export type PaginationMeta = {
    total: number;
    limit: number;
    nextCursor: string | null;
};

export type PaginatedResult<T> = {
    items: T[];
    total: number;
    limit: number;
    nextCursor: string | null;
};

class PaginationUtils {

    /** True when the caller explicitly opted into the paginated response envelope. */
    isRequested(query: PaginationQuery): boolean {
        return query.limit !== undefined || query.cursor !== undefined;
    }

    page<T>(items: T[], query: PaginationQuery): PaginatedResult<T> {
        const limit = query.limit ?? DEFAULT_PAGE_SIZE;
        const offset = this.parseCursor(query.cursor);
        const pageItems = items.slice(offset, offset + limit);
        const nextOffset = offset + pageItems.length;

        return {
            items: pageItems,
            total: items.length,
            limit,
            nextCursor: nextOffset < items.length ? String(nextOffset) : null,
        };
    }

    envelopeSchema<T extends z.ZodTypeAny>(itemSchema: T) {
        return z.object({
            items: z.array(itemSchema),
            total: z.number().int(),
            limit: z.number().int(),
            nextCursor: z.string().nullable(),
        });
    }

    /** Bare array for existing callers, paginated envelope when limit/cursor is supplied. */
    responseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
        return z.union([z.array(itemSchema), this.envelopeSchema(itemSchema)]);
    }

    private parseCursor(cursor?: string): number {
        if (cursor === undefined || cursor === '') {
            return 0;
        }
        if (!/^\d+$/.test(cursor)) {
            throw new ServiceException('Invalid cursor. Pass the nextCursor value from the previous response.');
        }
        return Number(cursor);
    }
}

const paginationUtils = new PaginationUtils();
export default paginationUtils;
