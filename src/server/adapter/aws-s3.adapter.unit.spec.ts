import { describe, expect, it } from 'vitest';
import s3Adapter from './aws-s3.adapter';

describe('AwsS3Adapter', () => {

    describe('getEndpointUrl', () => {
        it('adds https scheme when endpoint has no scheme', () => {
            expect(s3Adapter.getEndpointUrl('nbg1.your-objectstorage.com')).toBe('https://nbg1.your-objectstorage.com');
        });

        it('preserves an explicit http scheme', () => {
            expect(s3Adapter.getEndpointUrl('http://minio.local:9000')).toBe('http://minio.local:9000');
        });

        it('preserves an explicit https scheme', () => {
            expect(s3Adapter.getEndpointUrl('https://nbg1.your-objectstorage.com')).toBe('https://nbg1.your-objectstorage.com');
        });

        it('detects whether the normalized endpoint is secure', () => {
            expect(s3Adapter.isSecureEndpoint('nbg1.your-objectstorage.com')).toBe(true);
            expect(s3Adapter.isSecureEndpoint('http://minio.local:9000')).toBe(false);
        });
    });

    describe('getS3Client', () => {
        const target = {
            region: 'nbg1',
            accessKeyId: 'access-key',
            secretKey: 'secret-key',
            endpoint: 'nbg1.your-objectstorage.com',
            forcePathStyle: false,
        };

        it('creates an S3 client for a virtual-hosted style target', () => {
            const client = s3Adapter.getS3Client(target);
            expect(client).toBeDefined();
        });

        it('creates an S3 client for a path-style target', () => {
            const client = s3Adapter.getS3Client({ ...target, forcePathStyle: true });
            expect(client).toBeDefined();
        });
    });
});
