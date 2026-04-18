import { PathUtils } from '@/server/utils/path.utils';

describe('PathUtils', () => {
    const originalEnv = (process.env as any);

    beforeEach(() => {
        jest.resetModules();
        (process.env as any) = { ...originalEnv };
    });

    afterEach(() => {
        (process.env as any) = originalEnv;
        PathUtils.isProduction = false;
    });

    describe('internalDataRoot', () => {
        it('should return production path when NODE_ENV is production', () => {
            PathUtils.isProduction = true;
            expect(PathUtils.internalDataRoot).toBe('/app/storage');
        });

        it('should return development path when NODE_ENV is not production', () => {
            expect(PathUtils.internalDataRoot).toBe('/workspace/storage/internal');
        });
    });

    describe('tempDataRoot', () => {
        it('should return production path when NODE_ENV is production', () => {
            PathUtils.isProduction = true;
            expect(PathUtils.tempDataRoot).toBe('/app/tmp-storage');
        });

        it('should return development path when NODE_ENV is not production', () => {
            expect(PathUtils.tempDataRoot).toBe('/workspace/storage/tmp');
        });
    });

    describe('gitRootPath', () => {
        it('should return the correct git root path', () => {
            expect(PathUtils.gitRootPath).toBe('/workspace/storage/tmp/git');
        });
    });

    describe('tempVolumeDownloadPath', () => {
        it('should return the correct temp volume download path', () => {
            expect(PathUtils.tempVolumeDownloadPath).toBe('/workspace/storage/tmp/volume-downloads');
        });
    });

    describe('gitRootPathForApp', () => {
        it('should return the correct git root path for app', () => {
            (process.env as any).NODE_ENV = 'development';
            const appId = 'testApp';
            expect(PathUtils.gitRootPathForApp(appId)).toBe('/workspace/storage/tmp/git/testApp');
        });
    });

    describe('deploymentLogsPath', () => {
        it('should return the correct deployment logs path', () => {
            (process.env as any).NODE_ENV = 'development';
            expect(PathUtils.deploymentLogsPath).toBe('/workspace/storage/internal/deployment-logs');
        });
    });

    describe('appDeploymentLogFile', () => {
        it('should return the correct app deployment log file path', () => {
            const deploymentId = 'deploy123';
            expect(PathUtils.appDeploymentLogFile(deploymentId)).toBe('/workspace/storage/internal/deployment-logs/deploy123.log');
        });
    });

    describe('volumeDownloadFolder', () => {
        it('should return the correct volume download folder path', () => {
            const volumeId = 'volume123';
            expect(PathUtils.volumeDownloadFolder(volumeId)).toBe('/workspace/storage/tmp/volume-downloads/volume123-data');
        });
    });

    describe('volumeDownloadZipPath', () => {
        it('should return the correct volume download zip path', () => {
            const volumeId = 'volume123';
            expect(PathUtils.volumeDownloadZipPath(volumeId)).toBe('/workspace/storage/tmp/volume-downloads/volume123.tar.gz');
        });
    });

    describe('convertIdToFolderFriendlyName', () => {
        it('should convert id to folder friendly name', () => {
            const id = 'test@123!';
            expect(PathUtils['convertIdToFolderFriendlyName'](id)).toBe('test_123_');
        });


    });


    describe('splitPath', () => {
        it('should split the path correctly when there is a folder', () => {
            const relativePath = 'folder/file.txt';
            const result = PathUtils.splitPath(relativePath);
            expect(result).toEqual({ folderPath: 'folder', filePath: 'file.txt' });
        });

        it('should split the path correctly when there is a folder 2', () => {
            const relativePath = '.backend/Dockerfile';
            const result = PathUtils.splitPath(relativePath);
            expect(result).toEqual({ folderPath: '.backend', filePath: 'Dockerfile' });
        });

        it('should split the path correctly when there is are 2 folders', () => {
            const relativePath = './cats/backend/Dockerfile';
            const result = PathUtils.splitPath(relativePath);
            expect(result).toEqual({ folderPath: './cats/backend', filePath: 'Dockerfile' });
        });

        it('should split the path correctly when there is no folder', () => {
            const relativePath = 'file.txt';
            const result = PathUtils.splitPath(relativePath);
            expect(result).toEqual({ folderPath: undefined, filePath: 'file.txt' });
        });


        it('should split the path correctly when there is no folder 2', () => {
            const relativePath = './file.txt';
            const result = PathUtils.splitPath(relativePath);
            expect(result).toEqual({ folderPath: undefined, filePath: 'file.txt' });
        });

        it('should split the path correctly when there are two points in the path', () => {
            const relativePath = './InnoSwipe.WebApi/Dockerfile';
            const result = PathUtils.splitPath(relativePath);
            expect(result).toEqual({ folderPath: './InnoSwipe.WebApi', filePath: 'Dockerfile' });
        });
    });

});