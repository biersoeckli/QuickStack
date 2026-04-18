import { promises } from 'dns';
import { FsUtils } from '@/server/utils/fs.utils';
import fs from 'fs';

jest.mock('fs', () => ({
    existsSync: jest.fn(),
    mkdirSync: jest.fn(),
    mkdir: jest.fn(),
    promises: {
        access: jest.fn(),
        readdir: jest.fn(),
        mkdir: jest.fn(),
        rm: jest.fn()
    }
}));

describe('FsUtils', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('fileExists', () => {
        it('should return true if file exists', async () => {
            (fs.promises.access as jest.Mock).mockResolvedValue(undefined);
            (fs.constants as any) = { F_OK: 0 };
            const result = await FsUtils.fileExists('path/to/file');
            expect(result).toBe(true);
        });

        it('should return false if file does not exist', async () => {
            (fs.promises.access as jest.Mock).mockRejectedValue(new Error('File not found'));
            const result = await FsUtils.fileExists('path/to/file');
            expect(result).toBe(false);
        });
    });

    describe('directoryExists', () => {
        it('should return true if directory exists', () => {
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            const result = FsUtils.directoryExists('path/to/dir');
            expect(result).toBe(true);
        });

        it('should return false if directory does not exist', () => {
            (fs.existsSync as jest.Mock).mockReturnValue(false);
            const result = FsUtils.directoryExists('path/to/dir');
            expect(result).toBe(false);
        });
    });

    describe('isFolderEmpty', () => {
        it('should return true if folder is empty', async () => {
            (fs.promises.readdir as jest.Mock).mockResolvedValue([]);
            const result = await FsUtils.isFolderEmpty('path/to/dir');
            expect(result).toBe(true);
        });

        it('should return false if folder is not empty', async () => {
            (fs.promises.readdir as jest.Mock).mockResolvedValue(['file1', 'file2']);
            const result = await FsUtils.isFolderEmpty('path/to/dir');
            expect(result).toBe(false);
        });
    });

    describe('createDirIfNotExists', () => {
        it('should create directory if it does not exist', () => {
            (fs.existsSync as jest.Mock).mockReturnValue(false);
            FsUtils.createDirIfNotExists('path/to/dir');
            expect(fs.mkdirSync).toHaveBeenCalledWith('path/to/dir', { recursive: false });
        });

        it('should not create directory if it exists', () => {
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            FsUtils.createDirIfNotExists('path/to/dir');
            expect(fs.mkdirSync).not.toHaveBeenCalled();
        });
    });

    describe('createDirIfNotExistsAsync', () => {
        it('should create directory if it does not exist', async () => {
            (fs.existsSync as jest.Mock).mockReturnValue(false);
            await FsUtils.createDirIfNotExistsAsync('path/to/dir');
            expect(fs.promises.mkdir).toHaveBeenCalledWith('path/to/dir', { recursive: false });
        });

        it('should not create directory if it exists', async () => {
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            await FsUtils.createDirIfNotExistsAsync('path/to/dir');
            expect(fs.promises.mkdir).not.toHaveBeenCalled();
        });
    });

    describe('deleteDirIfExistsAsync', () => {
        it('should delete directory if it exists', async () => {
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            await FsUtils.deleteDirIfExistsAsync('path/to/dir');
            expect(fs.promises.rm).toHaveBeenCalledWith('path/to/dir', { recursive: false });
        });

        it('should not delete directory if it does not exist', async () => {
            (fs.existsSync as jest.Mock).mockReturnValue(false);
            await FsUtils.deleteDirIfExistsAsync('path/to/dir');
            expect(fs.promises.rm).not.toHaveBeenCalled();
        });
    });
});