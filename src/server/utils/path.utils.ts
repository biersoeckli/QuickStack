import path from 'path';

export class PathUtils {

    static isProduction = process.env.NODE_ENV === 'production';
    static get internalDataRoot() {
        return this.isProduction ? '/app/storage' : '/workspace/storage/internal';
    }

    static get tempDataRoot() {
        return this.isProduction ? '/app/tmp-storage' : '/workspace/storage/tmp';
    }

    static get gitRootPath() {
        return path.join(this.tempDataRoot, 'git');
    }

    static get tempVolumeDownloadPath() {
        return path.join(this.tempDataRoot, 'volume-downloads');
    }

    static get tempBackupDataFolder() {
        return path.join(this.tempDataRoot, 'backup-data');
    }

    static gitRootPathForApp(appId: string): string {
        return path.join(PathUtils.gitRootPath, this.convertIdToFolderFriendlyName(appId));
    }

    static get deploymentLogsPath() {
        return path.join(this.internalDataRoot, 'deployment-logs');
    }

    static appDeploymentLogFile(deploymentId: string): string {
        return path.join(this.deploymentLogsPath, `${deploymentId}.log`);
    }

    static volumeDownloadFolder(volumeId: string): string {
        return path.join(this.tempVolumeDownloadPath, `${volumeId}-data`);
    }

    static volumeDownloadZipPath(volumeId: string): string {
        return path.join(this.tempVolumeDownloadPath, `${volumeId}.tar.gz`);
    }

    static backupVolumeDownloadZipPath(backupVolumeId: string): string {
        return path.join(this.tempBackupDataFolder, `${backupVolumeId}.tar.gz`);
    }

    static splitPath(relativePath: string): { folderPath: string | undefined; filePath: string } {
        if (!relativePath.includes('/')) {
            return { folderPath: undefined, filePath: relativePath };
        }

        const lastSlashIndex = relativePath.lastIndexOf('/');

        let folderPath = relativePath.substring(0, lastSlashIndex) || undefined;
        if (folderPath === '.') {
            folderPath = undefined;
        }
        const filePath = relativePath.substring(lastSlashIndex + 1);

        return { folderPath, filePath };
    }

    private static convertIdToFolderFriendlyName(id: string): string {
        // remove all special characters
        return id.replace(/[^a-zA-Z0-9]/g, '_');
    }
}
