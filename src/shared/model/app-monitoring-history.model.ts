export interface AppHistoryPoint {
  time: number;
  isGap?: boolean;
  cpuCores: number | null;
  ramBytes: number | null;
  storageBytes: number | null;
  availableVolumes: number;
  unavailableVolumes: number;
}
export interface AppVolumeHistory {
  id: string;
  label: string;
  points: { time: number; usedBytes: number | null; measuredAt: number | null }[];
}
export interface AppMonitoringHistory {
  retentionHours: number;
  points: AppHistoryPoint[];
  volumes: AppVolumeHistory[];
  latestCpuMeasurement: number | null;
  latestRamMeasurement: number | null;
  latestVolumeMeasurement: number | null;
}
