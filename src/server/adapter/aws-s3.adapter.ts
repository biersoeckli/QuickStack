import { S3Client } from "@aws-sdk/client-s3";

import { S3Target } from "@prisma/client";

export type S3ClientTarget = Pick<S3Target, 'region' | 'accessKeyId' | 'secretKey' | 'endpoint' | 'useSsl' | 'forcePathStyle'>;

class AwsS3Adapter {

    getEndpointUrl(endpoint: string, useSsl: boolean) {
        const host = /^https?:\/\//i.test(endpoint)
            ? endpoint.replace(/^https?:\/\//i, '')
            : endpoint;
        return `${useSsl ? 'https' : 'http'}://${host}`;
    }

    getS3Client(s3Target: S3ClientTarget) {
        return new S3Client({
            region: s3Target.region,
            credentials: {
                accessKeyId: s3Target.accessKeyId,
                secretAccessKey: s3Target.secretKey,
            },
            endpoint: this.getEndpointUrl(s3Target.endpoint, s3Target.useSsl),
            forcePathStyle: s3Target.forcePathStyle,
        });
    }
}

const s3Adapter = new AwsS3Adapter();
export default s3Adapter;
