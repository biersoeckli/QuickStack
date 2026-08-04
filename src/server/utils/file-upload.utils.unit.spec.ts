import stream from 'stream';
import { FileUploadUtils } from './file-upload.utils';

async function readStream(input: stream.Readable): Promise<string> {
    let content = '';
    for await (const chunk of input) content += chunk.toString();
    return content;
}

function multipartRequest(file: unknown): Request {
    return {
        headers: new Headers({ 'content-type': 'multipart/form-data; boundary=test' }),
        formData: vi.fn().mockResolvedValue({ get: vi.fn().mockReturnValue(file) }),
    } as unknown as Request;
}

describe('FileUploadUtils.getWriteFileStream', () => {
    it('streams raw octet-stream request bytes', async () => {
        const request = new Request('http://localhost/upload', {
            method: 'PUT',
            headers: { 'content-type': 'application/octet-stream' },
            body: 'raw file content',
        });

        await expect(readStream(await FileUploadUtils.getWriteFileStream(request))).resolves.toBe('raw file content');
    });

    it('streams the required multipart file field', async () => {
        const request = multipartRequest({
            stream: () => new ReadableStream({
                start(controller) {
                    controller.enqueue(new TextEncoder().encode('multipart file content'));
                    controller.close();
                },
            }),
        });

        await expect(readStream(await FileUploadUtils.getWriteFileStream(request))).resolves.toBe('multipart file content');
    });

    it('rejects multipart requests without a file field', async () => {
        await expect(FileUploadUtils.getWriteFileStream(multipartRequest(null)))
            .rejects.toThrow('Multipart uploads require a file field named "file".');
    });

    it('rejects unsupported content types', async () => {
        const request = new Request('http://localhost/upload', {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: '{}',
        });

        await expect(FileUploadUtils.getWriteFileStream(request))
            .rejects.toThrow('Unsupported file upload content type. Use multipart/form-data with a file field.');
    });
});
