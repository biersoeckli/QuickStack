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

    private static convertIdToFolderFriendlyName(id: string): string {
        // remove all special characters
        return id.replace(/[^a-zA-Z0-9]/g, '_');
    }
}
