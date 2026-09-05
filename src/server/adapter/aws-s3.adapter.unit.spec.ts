import { describe, expect, it } from 'vitest';
import s3Adapter from './aws-s3.adapter';

describe('AwsS3Adapter', () => {

    describe('getEndpointUrl', () => {
        it('adds https scheme when useSsl is true and endpoint has no scheme', () => {
            expect(s3Adapter.getEndpointUrl('nbg1.your-objectstorage.com', true)).toBe('https://nbg1.your-objectstorage.com');
        });

        it('keeps host and switches to http when useSsl is false', () => {
            expect(s3Adapter.getEndpointUrl('https://nbg1.your-objectstorage.com', false)).toBe('http://nbg1.your-objectstorage.com');
        });

        it('keeps host and scheme from endpoint when useSsl is true', () => {
            expect(s3Adapter.getEndpointUrl('http://minio.local:9000', true)).toBe('https://minio.local:9000');
        });
    });

    describe('getS3Client', () => {
        const target = {
            region: 'nbg1',
            accessKeyId: 'access-key',
            secretKey: 'secret-key',
            endpoint: 'nbg1.your-objectstorage.com',
            useSsl: true,
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
