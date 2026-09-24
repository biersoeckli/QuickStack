
function formatLocalDate(date: Date, options: Intl.DateTimeFormatOptions): string {
    return new Intl.DateTimeFormat(undefined, options).format(date);
}

type DateInput = Date | string | undefined | null;

function parseDate(date: DateInput): Date | undefined {
    if (typeof date === 'string') {
        date = new Date(date);
    }

    return date instanceof Date && !Number.isNaN(date.getTime()) ? date : undefined;
}

export function formatDate(date: DateInput): string {
    const parsedDate = parseDate(date);
    if (!parsedDate) {
        return '';
    }
    return formatLocalDate(parsedDate, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}

export function formatDateTime(date: DateInput, includeSeconds = false): string {
    const parsedDate = parseDate(date);
    if (!parsedDate) {
        return '';
    }
    return formatLocalDate(parsedDate, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        ...(includeSeconds && { second: '2-digit' }),
    });
}

export function formatTime(date: DateInput): string {
    const parsedDate = parseDate(date);
    if (!parsedDate) {
        return '';
    }
    return formatLocalDate(parsedDate, {
        hour: '2-digit',
        minute: '2-digit',
    });
}

export function formatBytes(bytes: number) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};
