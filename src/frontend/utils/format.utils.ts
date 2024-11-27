
import { formatInTimeZone } from 'date-fns-tz';

export function formatDate(date: Date | undefined | null): string {
    if (!date) {
        return '';
    }
    return formatInTimeZone(date, 'Europe/Zurich', 'dd.MM.yyyy');
}

export function formatDateTime(date: Date | undefined | null): string {
    if (!date) {
        return '';
    }
    return formatInTimeZone(date, 'Europe/Zurich', 'dd.MM.yyyy HH:mm');
}

export function formatTime(date: Date | undefined | null): string {
    if (!date) {
        return '';
    }
    return formatInTimeZone(date, 'Europe/Zurich', 'HH:mm');
}