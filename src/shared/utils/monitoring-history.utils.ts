export class MonitoringHistoryUtils {
  static readonly COLLECTION_INTERVAL_MINUTES = 5;
  static readonly COLLECTION_INTERVAL_MS = this.COLLECTION_INTERVAL_MINUTES * 60_000;
  static readonly GAP_THRESHOLD_MS = this.COLLECTION_INTERVAL_MS + 2 * 60_000;
}
