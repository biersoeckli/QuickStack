export interface BackupInfoModel {
    projectId: string;
    projectName: string;
    appName: string;
    appId: string;
    backupVolumeId: string;
    s3TargetId: string;
    volumeId: string;
    mountPath: string;
    backupRetention: number;
    backups: BackupEntry[];
    cron?: string;
    missedBackup?: boolean;
}

export interface BackupEntry {
    key: string;
    backupDate: Date;
    sizeBytes?: number;
}