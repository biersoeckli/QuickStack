import { DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, ListObjectsV2Command, type _Object } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { S3Target } from "@prisma/client";
import s3Adapter from "../adapter/aws-s3.adapter";
import { createReadStream, createWriteStream } from "fs";
import fsPromises from "fs/promises";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { ServiceException } from "../../shared/model/service.exception.model";


export class S3Service {

    private static readonly MIN_PART_SIZE = 8 * 1024 * 1024;
    private static readonly MAX_PART_SIZE = 5 * 1024 * 1024 * 1024;
    private static readonly MAX_PARTS_PER_UPLOAD = 9500;

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
        const fileKeys: _Object[] = [];
        let continuationToken: string | undefined;

        do {
            const output = await client.send(new ListObjectsV2Command({
                Bucket: s3Target.bucketName,
                ContinuationToken: continuationToken,
            }));
            fileKeys.push(...(output.Contents ?? []));
            continuationToken = output.IsTruncated ? output.NextContinuationToken : undefined;
        } while (continuationToken);

        return fileKeys;
    }

    async deleteFile(s3Target: S3Target, fileName: string) {
        const client = s3Adapter.getS3Client(s3Target);
        const command = new DeleteObjectCommand({
            Bucket: s3Target.bucketName,
            Key: fileName,
        });
        await client.send(command);
    }

    async downloadFile(s3Target: S3Target, key: string, outputFilePath: string) {
        const client = s3Adapter.getS3Client(s3Target);
        const command = new GetObjectCommand({
            Bucket: s3Target.bucketName,
            Key: key,
        });
        const response = await client.send(command);

        if (!response.Body) {
            throw new ServiceException('No file stream found');
        }

        try {
            await pipeline(response.Body as Readable, createWriteStream(outputFilePath));
        } catch (e) {
            await fsPromises.rm(outputFilePath, { force: true });
            throw e;
        }
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

        // Multipart upload keeps every request below the single-put limits of
        // S3-compatible endpoints (AWS S3 and s3s default to 5 GiB per request)
        // and bounds memory usage to partSize * queueSize.
        const upload = new Upload({
            client,
            params: {
                Bucket: s3Target.bucketName, // todo: use bucket from env
                Key: objectStorageFile.fileName,
                Body: createReadStream(inputFilePath),
                //ContentDisposition: 'inline',
                ContentType: mimeType,
            },
            partSize: await this.getUploadPartSize(inputFilePath),
            queueSize: 4,
            leavePartsOnError: false,
        });
        await upload.done();
    }

    private async getUploadPartSize(inputFilePath: string) {
        const { size } = await fsPromises.stat(inputFilePath);
        const sizeBasedPartSize = Math.ceil(size / S3Service.MAX_PARTS_PER_UPLOAD);
        const partSize = Math.max(S3Service.MIN_PART_SIZE, sizeBasedPartSize);
        const megabyte = 1024 * 1024;
        const roundedPartSize = Math.ceil(partSize / megabyte) * megabyte;
        return Math.min(roundedPartSize, S3Service.MAX_PART_SIZE);
    }
}

const s3Service = new S3Service();
export default s3Service;
