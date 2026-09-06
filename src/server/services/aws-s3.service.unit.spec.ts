vi.mock('../adapter/aws-s3.adapter', () => ({
    default: {
        getS3Client: vi.fn(),
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
