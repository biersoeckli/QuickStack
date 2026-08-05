import stream from 'stream';
import { ServiceException } from '@/shared/model/service.exception.model';

export class FileUploadUtils {
    static async getWriteFileStream(request: Request): Promise<stream.Readable> {
        const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';

        if (contentType.startsWith('multipart/form-data')) {
            const formData = await request.formData();
            const file = formData.get('file');
            if (!file || typeof file === 'string') {
                throw new ServiceException('Multipart uploads require a file field named "file".');
            }
            return stream.Readable.fromWeb(file.stream() as never);
        }

        if (contentType.startsWith('application/octet-stream')) {
            if (!request.body) throw new ServiceException('Request body is required.');
            return stream.Readable.fromWeb(request.body as never);
        }

        throw new ServiceException('Unsupported file upload content type. Use multipart/form-data with a file field.');
    }
}
