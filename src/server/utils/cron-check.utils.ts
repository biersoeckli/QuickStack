import { Constants } from '@/shared/utils/constants';
import { parseExpression } from 'cron-parser';

export class CronCheckUtils {

    /**
     * Parses a `@every <N><unit>` interval string (node-schedule syntax) into milliseconds.
     * Supported units: ns, us, µs, ms, s, m, h
     * Returns null if the format doesn't match or the unit is unknown.
     */
    private static parseEveryIntervalMs(cron: string): number | null {
        const match = cron.match(/^@every\s+(\d+(?:\.\d+)?)(ns|us|µs|ms|s|m|h)$/);
        if (!match) return null;
        const value = parseFloat(match[1]);
        const unit = match[2];
        const unitToMs: Record<string, number> = {
            ns: 1 / 1_000_000,
            us: 1 / 1_000,
            µs: 1 / 1_000,
            ms: 1,
            s: 1_000,
            m: 60_000,
            h: 3_600_000,
        };
        return value * unitToMs[unit];
    }

    /**
     * Returns the last scheduled time for a given cron expression, relative to `now`.
     * Returns null if the cron can't be evaluated (e.g. @reboot or parse error).
     */
    static getLastScheduledTime(cron: string, now: Date = new Date()): Date | null {
        // Handle @reboot – has no deterministic last run time
        if (cron.trim() === '@reboot') {
            return null;
        }

        // Handle @every <interval> (node-schedule-specific, not standard cron)
        if (cron.trim().startsWith('@every')) {
            const intervalMs = CronCheckUtils.parseEveryIntervalMs(cron.trim());
            if (intervalMs === null || intervalMs <= 0) return null;
            return new Date(now.getTime() - intervalMs);
        }

        // Handle standard cron expressions + @daily/@weekly/@monthly/@annually/@yearly/@hourly
        try {
            const interval = parseExpression(cron, { currentDate: now, iterator: false });
            const prev = interval.prev();
            return prev.toDate();
        } catch {
            return null;
        }
    }

    /**
     * Returns true when the backup is considered "missed":
     * - The last scheduled run time can be determined from the cron expression
     * - AND the latest backup was created before (lastScheduledTime - tolerance)
     *
     * Returns false when backups are up to date.
     * Returns undefined when the schedule cannot be evaluated.
     */
    static isBackupMissed(
        cron: string,
        latestBackupDate: Date | undefined,
        toleranceMs: number = Constants.TOLERATION_FOR_EXECUTED_CRON_BACKUPS_MS,
        now: Date = new Date(),
    ): boolean | undefined {
        const lastScheduledTime = CronCheckUtils.getLastScheduledTime(cron, now);
        if (lastScheduledTime === null) {
            return undefined;
        }

        if (!latestBackupDate) {
            // No backup ever created – already tracked by backupsVolumesWithoutActualBackups,
            // but we still flag it here for status display.
            return true;
        }

        // Backup is missed if the latest backup pre-dates (lastScheduledTime - tolerance)
        return latestBackupDate.getTime() < lastScheduledTime.getTime() - toleranceMs;
    }
}
