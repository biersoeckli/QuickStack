
function formatLocalDate(date: Date, options: Intl.DateTimeFormatOptions): string {
    return new Intl.DateTimeFormat(undefined, options).format(date);
}

export function formatDate(date: Date | undefined | null): string {
    if (!date) {
        return '';
    }
    return formatLocalDate(date, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}

export function formatDateTime(date: Date | undefined | null, includeSeconds = false): string {
    if (!date) {
        return '';
    }
    return formatLocalDate(date, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        ...(includeSeconds && { second: '2-digit' }),
    });
}

export function formatTime(date: Date | undefined | null): string {
    if (!date) {
        return '';
    }
    return formatLocalDate(date, {
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
