import { z } from 'zod';
import { ServiceException } from '@/shared/model/service.exception.model';
import paginationUtils, {
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
    paginationQueryZodModel,
} from './pagination.utils';

describe('pagination.utils', () => {
    describe('isRequested', () => {
        it('is false for an empty query', () => {
            expect(paginationUtils.isRequested({})).toBe(false);
        });

        it('is true when limit or cursor is supplied', () => {
            expect(paginationUtils.isRequested({ limit: 10 })).toBe(true);
            expect(paginationUtils.isRequested({ cursor: '20' })).toBe(true);
        });
    });

    describe('page', () => {
        const items = Array.from({ length: 60 }, (_value, index) => index + 1);

        it('defaults to the default page size and exposes the next cursor', () => {
            const result = paginationUtils.page(items, {});

            expect(result.items).toHaveLength(DEFAULT_PAGE_SIZE);
            expect(result.items[0]).toBe(1);
            expect(result.items[DEFAULT_PAGE_SIZE - 1]).toBe(DEFAULT_PAGE_SIZE);
            expect(result.total).toBe(60);
            expect(result.limit).toBe(DEFAULT_PAGE_SIZE);
            expect(result.nextCursor).toBe(String(DEFAULT_PAGE_SIZE));
        });

        it('continues from an opaque cursor', () => {
            const result = paginationUtils.page(items, { limit: 2, cursor: '2' });

            expect(result.items).toEqual([3, 4]);
            expect(result.nextCursor).toBe('4');
        });

        it('returns a null cursor on the last page', () => {
            const result = paginationUtils.page(items, { limit: 10, cursor: '50' });

            expect(result.items).toEqual([51, 52, 53, 54, 55, 56, 57, 58, 59, 60]);
            expect(result.nextCursor).toBeNull();
        });

        it('rejects a malformed cursor', () => {
            expect(() => paginationUtils.page(items, { cursor: 'not-a-cursor' })).toThrow(ServiceException);
            expect(() => paginationUtils.page(items, { cursor: 'not-a-cursor' })).toThrow('Invalid cursor');
        });
    });

    describe('query schema', () => {
        it('coerces a string limit and keeps the cursor', () => {
            expect(paginationQueryZodModel.parse({ limit: '25', cursor: '50' })).toEqual({ limit: 25, cursor: '50' });
        });

        it('enforces the maximum page size', () => {
            expect(paginationQueryZodModel.safeParse({ limit: MAX_PAGE_SIZE + 1 }).success).toBe(false);
        });
    });

    describe('responseSchema', () => {
        const schema = paginationUtils.responseSchema(z.object({ id: z.string() }));

        it('accepts the legacy bare array response', () => {
            expect(schema.parse([{ id: 'a' }])).toEqual([{ id: 'a' }]);
        });

        it('accepts the paginated envelope response', () => {
            const envelope = { items: [{ id: 'a' }], total: 1, limit: 50, nextCursor: null };
            expect(schema.parse(envelope)).toEqual(envelope);
        });
    });
});
