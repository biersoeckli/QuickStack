export interface AppVolumeMonitoringUsageModel {
    projectId: string,
    projectName: string,
    appName: string,
    appId: string,
    mountPath: string,
    usedBytes: number,
    capacityBytes: number,
    isBaseVolume: boolean
}
