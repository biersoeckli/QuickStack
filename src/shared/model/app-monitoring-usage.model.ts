export interface AppMonitoringUsageModel {
    projectId: string,
    projectName: string,
    appName: string,
    appId: string,
    cpuUsage: number,
    cpuUsagePercent: number,
    ramUsageBytes: number
}
