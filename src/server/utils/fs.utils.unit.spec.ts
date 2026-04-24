import { promises } from 'dns';
import { FsUtils } from '@/server/utils/fs.utils';
import fs from 'fs';

vi.mock('fs', () => ({
    default: {
        existsSync: vi.fn(),
        mkdirSync: vi.fn(),
        mkdir: vi.fn(),
        promises: {
            access: vi.fn(),
            readdir: vi.fn(),
            mkdir: vi.fn(),
            rm: vi.fn()
        }
    },
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    mkdir: vi.fn(),
    promises: {
        access: vi.fn(),
        readdir: vi.fn(),
        mkdir: vi.fn(),
        rm: vi.fn()
    }
}));

describe('FsUtils', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('fileExists', () => {
        it('should return true if file exists', async () => {
            vi.mocked(fs.promises.access).mockResolvedValue(undefined);
            (fs.constants as any) = { F_OK: 0 };
            const result = await FsUtils.fileExists('path/to/file');
            expect(result).toBe(true);
        });

        it('should return false if file does not exist', async () => {
            vi.mocked(fs.promises.access).mockRejectedValue(new Error('File not found'));
            const result = await FsUtils.fileExists('path/to/file');
            expect(result).toBe(false);
        });
    });

    describe('directoryExists', () => {
        it('should return true if directory exists', () => {
            vi.mocked(fs.existsSync).mockReturnValue(true);
            const result = FsUtils.directoryExists('path/to/dir');
            expect(result).toBe(true);
        });

        it('should return false if directory does not exist', () => {
            vi.mocked(fs.existsSync).mockReturnValue(false);
            const result = FsUtils.directoryExists('path/to/dir');
            expect(result).toBe(false);
        });
    });

    describe('isFolderEmpty', () => {
        it('should return true if folder is empty', async () => {
            vi.mocked(fs.promises.readdir as any).mockResolvedValue([]);
            const result = await FsUtils.isFolderEmpty('path/to/dir');
            expect(result).toBe(true);
        });

        it('should return false if folder is not empty', async () => {
            vi.mocked(fs.promises.readdir as any).mockResolvedValue(['file1', 'file2']);
            const result = await FsUtils.isFolderEmpty('path/to/dir');
            expect(result).toBe(false);
        });
    });

    describe('createDirIfNotExists', () => {
        it('should create directory if it does not exist', () => {
            vi.mocked(fs.existsSync).mockReturnValue(false);
            FsUtils.createDirIfNotExists('path/to/dir');
            expect(fs.mkdirSync).toHaveBeenCalledWith('path/to/dir', { recursive: false });
        });

        it('should not create directory if it exists', () => {
            vi.mocked(fs.existsSync).mockReturnValue(true);
            FsUtils.createDirIfNotExists('path/to/dir');
            expect(fs.mkdirSync).not.toHaveBeenCalled();
        });
    });

    describe('createDirIfNotExistsAsync', () => {
        it('should create directory if it does not exist', async () => {
            vi.mocked(fs.existsSync).mockReturnValue(false);
            await FsUtils.createDirIfNotExistsAsync('path/to/dir');
            expect(fs.promises.mkdir).toHaveBeenCalledWith('path/to/dir', { recursive: false });
        });

        it('should not create directory if it exists', async () => {
            vi.mocked(fs.existsSync).mockReturnValue(true);
            await FsUtils.createDirIfNotExistsAsync('path/to/dir');
            expect(fs.promises.mkdir).not.toHaveBeenCalled();
        });
    });

    describe('deleteDirIfExistsAsync', () => {
        it('should delete directory if it exists', async () => {
            vi.mocked(fs.existsSync).mockReturnValue(true);
            await FsUtils.deleteDirIfExistsAsync('path/to/dir');
            expect(fs.promises.rm).toHaveBeenCalledWith('path/to/dir', { recursive: false });
        });

        it('should not delete directory if it does not exist', async () => {
            vi.mocked(fs.existsSync).mockReturnValue(false);
            await FsUtils.deleteDirIfExistsAsync('path/to/dir');
            expect(fs.promises.rm).not.toHaveBeenCalled();
        });
    });
});