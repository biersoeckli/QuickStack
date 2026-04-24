import { ListUtils } from '@/shared/utils/list.utils';

describe('ListUtils', () => {

    describe('removeDuplicates', () => {
        it('should remove duplicates from an array', () => {
            const array = [1, 2, 2, 3, 4, 4, 5];
            const result = ListUtils.removeDuplicates(array);
            expect(result).toEqual([1, 2, 3, 4, 5]);
        });
    });

    describe('sortByDate', () => {
        it('should sort an array by date in ascending order', () => {
            const array = [
                { date: new Date('2021-01-01') },
                { date: new Date('2020-01-01') },
                { date: new Date('2022-01-01') }
            ];
            const result = ListUtils.sortByDate(array, item => item.date);
            expect(result).toEqual([
                { date: new Date('2020-01-01') },
                { date: new Date('2021-01-01') },
                { date: new Date('2022-01-01') }
            ]);
        });

        it('should sort an array by date in descending order', () => {
            const array = [
                { date: new Date('2021-01-01') },
                { date: new Date('2020-01-01') },
                { date: new Date('2022-01-01') }
            ];
            const result = ListUtils.sortByDate(array, item => item.date, true);
            expect(result).toEqual([
                { date: new Date('2022-01-01') },
                { date: new Date('2021-01-01') },
                { date: new Date('2020-01-01') }
            ]);
        });
    });

    describe('distinctBy', () => {
        it('should return distinct elements by key', () => {
            const array = [
                { id: 1, name: 'Alice' },
                { id: 2, name: 'Bob' },
                { id: 1, name: 'Alice' }
            ];
            const result = ListUtils.distinctBy(array, item => item.id);
            expect(result).toEqual([
                { id: 1, name: 'Alice' },
                { id: 2, name: 'Bob' }
            ]);
        });
    });

    describe('groupBy', () => {
        it('should group elements by key', () => {
            const array = [
                { category: 'A', value: 1 },
                { category: 'B', value: 2 },
                { category: 'A', value: 3 }
            ];
            const result = ListUtils.groupBy(array, item => item.category);
            expect(result).toEqual(new Map([
                ['A', [{ category: 'A', value: 1 }, { category: 'A', value: 3 }]],
                ['B', [{ category: 'B', value: 2 }]]
            ]));
        });
    });

    describe('chunk', () => {
        it('should split an array into chunks of specified size', () => {
            const array = [1, 2, 3, 4, 5, 6, 7];
            const result = ListUtils.chunk(array, 3);
            expect(result).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
        });
    });

    describe('removeNulls', () => {
        it('should remove null values from an array', () => {
            const array = [1, null, 2, null, 3];
            const result = ListUtils.removeNulls(array);
            expect(result).toEqual([1, 2, 3]);
        });
    });

});