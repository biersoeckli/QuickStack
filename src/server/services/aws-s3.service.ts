import { DeleteObjectCommand, HeadBucketCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { S3Target } from "@prisma/client";
import s3Adapter from "../adapter/aws-s3.adapter";
import { randomUUID } from "crypto";
import { createReadStream } from "fs";


export class S3Service {

    async testConnection(target: S3Target) {
        try {
            const client = s3Adapter.getS3Client(target);
            const output = await client.send(new HeadBucketCommand({ Bucket: target.bucketName }));
            return output.$metadata.httpStatusCode === 200;
        } catch (e) {
            console.log('Error while testing connection to S3 Target', target, e);
            return false;
        }
    }

    async listFiles(s3Target: S3Target) {
        const client = s3Adapter.getS3Client(s3Target);
        const command = new ListObjectsV2Command({
            Bucket: s3Target.bucketName,
        });
        const output = await client.send(command);
        return output.Contents ?? [];
    }

    async deleteFile(s3Target: S3Target, fileName: string) {
        const client = s3Adapter.getS3Client(s3Target);
        const command = new DeleteObjectCommand({
            Bucket: s3Target.bucketName,
            Key: fileName,
        });
        await client.send(command);
    }

    async uploadFile(s3Target: S3Target,
        inputFilePath: string,
        fileName: string,
        mimeType: string,
        encoding: string) {

        const client = s3Adapter.getS3Client(s3Target);

        let fileEnding = fileName.split('.').pop();
        if (!fileEnding) {
            throw new Error(`Filename ${fileName} is invalid`);
        }

        const objectStorageFile = {
            originalFilename: fileName,
            mimeType,
            encoding,
            fileEnding,
            fileName: fileName
        };

        const command = new PutObjectCommand({
            Bucket: s3Target.bucketName, // todo: use bucket from env
            Key: objectStorageFile.fileName,
            Body: createReadStream(inputFilePath),
            //ContentDisposition: 'inline',
            ContentType: mimeType,
        });
        await client.send(command);
    }
}

const s3Service = new S3Service();
export default s3Service;