
import { formatDate, formatDateTime, formatTime } from '@/frontend/utils/format.utils';
import { formatInTimeZone } from 'date-fns-tz';

jest.mock('date-fns-tz', () => ({
    formatInTimeZone: jest.fn(),
}));

describe('format.utils', () => {
    const mockDate = new Date('2023-10-10T10:10:10Z');

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('formatDate', () => {
        it('should return formatted date string for valid date', () => {
            (formatInTimeZone as jest.Mock).mockReturnValue('10.10.2023');
            const result = formatDate(mockDate);
            expect(result).toBe('10.10.2023');
            expect(formatInTimeZone).toHaveBeenCalledWith(mockDate, 'Europe/Zurich', 'dd.MM.yyyy');
        });

        it('should return empty string for undefined date', () => {
            const result = formatDate(undefined);
            expect(result).toBe('');
            expect(formatInTimeZone).not.toHaveBeenCalled();
        });

        it('should return empty string for null date', () => {
            const result = formatDate(null);
            expect(result).toBe('');
            expect(formatInTimeZone).not.toHaveBeenCalled();
        });
    });

    describe('formatDateTime', () => {
        it('should return formatted date-time string for valid date', () => {
            (formatInTimeZone as jest.Mock).mockReturnValue('10.10.2023 12:10');
            const result = formatDateTime(mockDate);
            expect(result).toBe('10.10.2023 12:10');
            expect(formatInTimeZone).toHaveBeenCalledWith(mockDate, 'Europe/Zurich', 'dd.MM.yyyy HH:mm');
        });

        it('should return empty string for undefined date', () => {
            const result = formatDateTime(undefined);
            expect(result).toBe('');
            expect(formatInTimeZone).not.toHaveBeenCalled();
        });

        it('should return empty string for null date', () => {
            const result = formatDateTime(null);
            expect(result).toBe('');
            expect(formatInTimeZone).not.toHaveBeenCalled();
        });
    });

    describe('formatTime', () => {
        it('should return formatted time string for valid date', () => {
            (formatInTimeZone as jest.Mock).mockReturnValue('12:10');
            const result = formatTime(mockDate);
            expect(result).toBe('12:10');
            expect(formatInTimeZone).toHaveBeenCalledWith(mockDate, 'Europe/Zurich', 'HH:mm');
        });

        it('should return empty string for undefined date', () => {
            const result = formatTime(undefined);
            expect(result).toBe('');
            expect(formatInTimeZone).not.toHaveBeenCalled();
        });

        it('should return empty string for null date', () => {
            const result = formatTime(null);
            expect(result).toBe('');
            expect(formatInTimeZone).not.toHaveBeenCalled();
        });
    });
});