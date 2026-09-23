
import { formatDate, formatDateTime, formatTime } from '@/frontend/utils/format.utils';

describe('format.utils', () => {
    const mockDate = new Date('2023-10-10T10:10:10Z');
    const format = vi.fn();
    const dateTimeFormat = vi.fn(() => ({ format }));

    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal('Intl', {
            DateTimeFormat: class {
                constructor(...args: unknown[]) {
                    dateTimeFormat(...args);
                }

                format = format;
            },
        });
        format.mockReturnValue('formatted date');
    });

    afterEach(() => vi.unstubAllGlobals());

    describe('formatDate', () => {
        it('should return formatted date string for valid date', () => {
            const result = formatDate(mockDate);
            expect(result).toBe('formatted date');
            expect(dateTimeFormat).toHaveBeenCalledWith(undefined, {
                day: '2-digit', month: '2-digit', year: 'numeric',
            });
            expect(format).toHaveBeenCalledWith(mockDate);
        });

        it('should return empty string for undefined date', () => {
            const result = formatDate(undefined);
            expect(result).toBe('');
            expect(dateTimeFormat).not.toHaveBeenCalled();
        });

        it('should return empty string for null date', () => {
            const result = formatDate(null);
            expect(result).toBe('');
            expect(dateTimeFormat).not.toHaveBeenCalled();
        });
    });

    describe('formatDateTime', () => {
        it('should return formatted date-time string for valid date', () => {
            const result = formatDateTime(mockDate);
            expect(result).toBe('formatted date');
            expect(dateTimeFormat).toHaveBeenCalledWith(undefined, {
                day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
            });
            expect(format).toHaveBeenCalledWith(mockDate);
        });

        it('should include seconds when requested', () => {
            formatDateTime(mockDate, true);
            expect(dateTimeFormat).toHaveBeenCalledWith(undefined, {
                day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
            });
        });

        it('should return empty string for undefined date', () => {
            const result = formatDateTime(undefined);
            expect(result).toBe('');
            expect(dateTimeFormat).not.toHaveBeenCalled();
        });

        it('should return empty string for null date', () => {
            const result = formatDateTime(null);
            expect(result).toBe('');
            expect(dateTimeFormat).not.toHaveBeenCalled();
        });
    });

    describe('formatTime', () => {
        it('should return formatted time string for valid date', () => {
            const result = formatTime(mockDate);
            expect(result).toBe('formatted date');
            expect(dateTimeFormat).toHaveBeenCalledWith(undefined, {
                hour: '2-digit', minute: '2-digit',
            });
            expect(format).toHaveBeenCalledWith(mockDate);
        });

        it('should return empty string for undefined date', () => {
            const result = formatTime(undefined);
            expect(result).toBe('');
            expect(dateTimeFormat).not.toHaveBeenCalled();
        });

        it('should return empty string for null date', () => {
            const result = formatTime(null);
            expect(result).toBe('');
            expect(dateTimeFormat).not.toHaveBeenCalled();
        });
    });
});
