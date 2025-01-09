export interface BackupInfoModel {
    projectId: string;
    projectName: string;
    appName: string;
    appId: string;
    backupVolumeId: string;
    volumeId: string;
    mountPath: string;
    backupRetention: number;
    backups: BackupEntry[]
}

export interface BackupEntry {
    key: string;
    backupDate: Date;
    sizeBytes?: number;
}