import { Readable } from 'stream';
import fs from 'fs';
import os from 'os';
import path from 'path';

vi.mock('../adapter/aws-s3.adapter', () => ({
    default: {
        getS3Client: vi.fn(),
    },
}));

// Keep mocked multipart uploads from opening the temporary archive after the
// test has already removed it.
vi.mock('fs', async (importOriginal) => {
    const actual = await importOriginal<typeof import('fs')>();
    const { Readable } = await import('stream');
    const createReadStream = vi.fn(() => Readable.from([])) as any;
    return {
        ...actual,
        createReadStream,
        default: { ...(actual as any).default, createReadStream },
    };
});

const uploadMocks = vi.hoisted(() => {
    const done = vi.fn().mockResolvedValue({});
    const constructor = vi.fn();
    return { done, constructor };
});

vi.mock('@aws-sdk/lib-storage', () => ({
    Upload: class {
        constructor(options: unknown) {
            uploadMocks.constructor(options);
        }

        done() {
            return uploadMocks.done();
        }
    },
}));

import s3Adapter from '../adapter/aws-s3.adapter';
import { S3Service } from './aws-s3.service';

describe('S3Service.listFiles', () => {
    const target = { bucketName: 'backups' } as any;

    it('loads every ListObjectsV2 page', async () => {
        const send = vi.fn()
            .mockResolvedValueOnce({
                Contents: [{ Key: 'backup-001' }],
                IsTruncated: true,
                NextContinuationToken: 'next-page',
            })
            .mockResolvedValueOnce({
                Contents: [{ Key: 'backup-1001' }],
                IsTruncated: false,
            });
        vi.mocked(s3Adapter.getS3Client).mockReturnValue({ send } as any);

        await expect(new S3Service().listFiles(target)).resolves.toEqual([
            { Key: 'backup-001' },
            { Key: 'backup-1001' },
        ]);
        expect(send).toHaveBeenCalledTimes(2);
        expect(send.mock.calls[1][0].input).toMatchObject({
            Bucket: 'backups',
            ContinuationToken: 'next-page',
        });
    });
});

describe('S3Service file transfer', () => {
    const target = { bucketName: 'backups' } as any;
    const megabyte = 1024 * 1024;
    let tempDir: string;

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qs-s3-service-'));
        uploadMocks.constructor.mockClear();
        uploadMocks.done.mockClear();
    });

    afterEach(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
        vi.mocked(s3Adapter.getS3Client).mockReset();
    });

    function createSparseFile(sizeInBytes: number) {
        const filePath = path.join(tempDir, 'backup.tar.gz');
        fs.writeFileSync(filePath, '');
        fs.truncateSync(filePath, Math.round(sizeInBytes));
        return filePath;
    }

    it('uploads through lib-storage multipart with bounded parts', async () => {
        const filePath = createSparseFile(5.3 * 1024 * 1024 * 1024);
        vi.mocked(s3Adapter.getS3Client).mockReturnValue({ send: vi.fn() } as any);

        await new S3Service().uploadFile(target, filePath, 'backups/app/volume/date.tar.gz', 'application/gzip', 'binary');

        expect(uploadMocks.done).toHaveBeenCalledTimes(1);
        expect(uploadMocks.constructor).toHaveBeenCalledWith(expect.objectContaining({
            partSize: 8 * megabyte,
            queueSize: 4,
            leavePartsOnError: false,
            params: expect.objectContaining({
                Bucket: 'backups',
                Key: 'backups/app/volume/date.tar.gz',
                ContentType: 'application/gzip',
            }),
        }));
    });

    it('uses a single PutObject when the target opts out of multipart', async () => {
        const filePath = createSparseFile(5.3 * 1024 * 1024 * 1024);
        const send = vi.fn().mockResolvedValue({});
        vi.mocked(s3Adapter.getS3Client).mockReturnValue({ send } as any);

        await new S3Service().uploadFile(
            { bucketName: 'backups', useSinglePutObject: true } as any,
            filePath,
            'backups/app/volume/date.tar.gz',
            'application/gzip',
            'binary',
        );

        expect(uploadMocks.constructor).not.toHaveBeenCalled();
        expect(uploadMocks.done).not.toHaveBeenCalled();
        expect(send).toHaveBeenCalledTimes(1);
        expect(send.mock.calls[0][0].input).toMatchObject({
            Bucket: 'backups',
            Key: 'backups/app/volume/date.tar.gz',
            ContentType: 'application/gzip',
        });
    });

    it('grows the part size for very large volumes to stay below the part limit', async () => {
        const filePath = createSparseFile(100 * 1024 * 1024 * 1024);
        vi.mocked(s3Adapter.getS3Client).mockReturnValue({ send: vi.fn() } as any);

        await new S3Service().uploadFile(target, filePath, 'backup.tar.gz', 'application/gzip', 'binary');

        const uploadOptions = uploadMocks.constructor.mock.calls[0][0];
        expect(uploadOptions.partSize).toBe(11 * megabyte);
        expect((100 * 1024 * 1024 * 1024) / uploadOptions.partSize).toBeLessThan(9500);
    });

    it('streams downloads to disk', async () => {
        const outputFilePath = path.join(tempDir, 'downloaded.tar.gz');
        const send = vi.fn().mockResolvedValue({ Body: Readable.from([Buffer.from('backup-data')]) });
        vi.mocked(s3Adapter.getS3Client).mockReturnValue({ send } as any);

        await new S3Service().downloadFile(target, 'backups/app/volume/date.tar.gz', outputFilePath);

        expect(fs.readFileSync(outputFilePath, 'utf-8')).toBe('backup-data');
        expect(send.mock.calls[0][0].input).toMatchObject({
            Bucket: 'backups',
            Key: 'backups/app/volume/date.tar.gz',
        });
    });

    it('fails when the download body is missing', async () => {
        const outputFilePath = path.join(tempDir, 'downloaded.tar.gz');
        vi.mocked(s3Adapter.getS3Client).mockReturnValue({ send: vi.fn().mockResolvedValue({}) } as any);

        await expect(new S3Service().downloadFile(target, 'key', outputFilePath))
            .rejects.toThrow('No file stream found');
        expect(fs.existsSync(outputFilePath)).toBe(false);
    });
});
