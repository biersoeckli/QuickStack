import { S3Client } from "@aws-sdk/client-s3";

import { S3Target } from "@prisma/client";

export type S3ClientTarget = Pick<S3Target, 'region' | 'accessKeyId' | 'secretKey' | 'endpoint' | 'forcePathStyle'>;

class AwsS3Adapter {

    getEndpointUrl(endpoint: string) {
        return /^https?:\/\//i.test(endpoint)
            ? endpoint
            : `https://${endpoint}`;
    }

    isSecureEndpoint(endpoint: string) {
        return new URL(this.getEndpointUrl(endpoint)).protocol === 'https:';
    }

    getS3Client(s3Target: S3ClientTarget) {
        return new S3Client({
            region: s3Target.region,
            credentials: {
                accessKeyId: s3Target.accessKeyId,
                secretAccessKey: s3Target.secretKey,
            },
            endpoint: this.getEndpointUrl(s3Target.endpoint),
            forcePathStyle: s3Target.forcePathStyle,
            // Do not add flexible checksums unless an operation requires them.
            // Several S3-compatible endpoints reject the CRC32 headers that
            // newer SDK versions add by default.
            requestChecksumCalculation: 'WHEN_REQUIRED',
            responseChecksumValidation: 'WHEN_REQUIRED',
        });
    }
}

const s3Adapter = new AwsS3Adapter();
export default s3Adapter;
