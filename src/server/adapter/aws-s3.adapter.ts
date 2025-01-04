import { DeleteObjectCommand, HeadBucketCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { S3Target } from "@prisma/client";
import { createReadStream } from "fs";

class AwsS3Adapter {

    getS3Client(s3Target: S3Target) {
        return new S3Client({
            region: s3Target.region,
            credentials: {
                accessKeyId: s3Target.accessKeyId,
                secretAccessKey: s3Target.secretKey,
            },
            endpoint: `https://${s3Target.endpoint}`
        });
    }
}

const s3Adapter = new AwsS3Adapter();
export default s3Adapter;