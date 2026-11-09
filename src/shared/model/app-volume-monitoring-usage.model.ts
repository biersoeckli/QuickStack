export type VolumeUsageStatus = 'available' | 'unavailable' | 'stale' | 'unsupported';

export interface VolumeFilesystemUsage {
  pvcName: string;
  status: VolumeUsageStatus;
  usedBytes?: number;
  availableBytes?: number;
  capacityBytes?: number;
  measuredAt?: string;
}

export interface AppVolumeMonitoringUsageModel extends VolumeFilesystemUsage {
  projectId: string;
  projectName: string;
  appName: string;
  appId: string;
  mountPath: string;
  isBaseVolume: boolean;
}
