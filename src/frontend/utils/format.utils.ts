
import { formatInTimeZone } from 'date-fns-tz';

export function formatDate(date: Date | undefined | null): string {
    if (!date) {
        return '';
    }
    return formatInTimeZone(date, 'Europe/Zurich', 'dd.MM.yyyy');
}

export function formatDateTime(date: Date | undefined | null, includeSeconds = false): string {
    if (!date) {
        return '';
    }
    if (includeSeconds) {
        return formatInTimeZone(date, 'Europe/Zurich', 'dd.MM.yyyy HH:mm:ss');
    }
    return formatInTimeZone(date, 'Europe/Zurich', 'dd.MM.yyyy HH:mm');
}

export function formatTime(date: Date | undefined | null): string {
    if (!date) {
        return '';
    }
    return formatInTimeZone(date, 'Europe/Zurich', 'HH:mm');
}

export function formatBytes(bytes: number) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};