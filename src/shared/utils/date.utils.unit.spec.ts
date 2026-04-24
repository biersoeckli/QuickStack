import { DateUtils } from '@/shared/utils/date.utils';

describe('DateUtils', () => {

    test('should return true for the same day', () => {
        const date1 = new Date(2023, 9, 10);
        const date2 = new Date(2023, 9, 10);
        expect(DateUtils.isSameDay(date1, date2)).toBe(true);
    });

    test('should return false for different days', () => {
        const date1 = new Date(2023, 9, 10);
        const date2 = new Date(2023, 9, 11);
        expect(DateUtils.isSameDay(date1, date2)).toBe(false);
    });

    test('should return false for different months', () => {
        const date1 = new Date(2023, 8, 10);
        const date2 = new Date(2023, 9, 10);
        expect(DateUtils.isSameDay(date1, date2)).toBe(false);
    });

    test('should return false for different years', () => {
        const date1 = new Date(2022, 9, 10);
        const date2 = new Date(2023, 9, 10);
        expect(DateUtils.isSameDay(date1, date2)).toBe(false);
    });
});