import { FsUtils } from "@/server/utils/fs.utils";
import { PathUtils } from "@/server/utils/path.utils";
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { createReadStream } from "fs";
import fs from 'fs/promises';
import { Readable } from "stream";
import { getAuthUserSession } from "@/server/utils/action-wrapper.utils";
import { ServiceException } from "@/shared/model/service.exception.model";

export const dynamic = 'force-dynamic' // defaults to auto

export async function GET(request: NextRequest) {
    try {
        await getAuthUserSession();
        const requestUrl = new URL(request.url);
        const fileName = requestUrl.searchParams.get('fileName');
        if (!fileName) {
            throw new ServiceException('No file name provided.');
        }

        if (fileName.includes('..') || fileName.includes('/')) {
            throw new ServiceException('Invalid file name.');
        }

        const dirOfTempDoanloadedData = PathUtils.tempVolumeDownloadPath;
        const tarPath = path.join(dirOfTempDoanloadedData, fileName);
        if (!await FsUtils.fileExists(tarPath)) {
            throw new ServiceException(`File ${fileName} does not exist.`);
        }

        const fileSize = (await fs.stat(tarPath)).size;
        const fileStream = Readable.toWeb(createReadStream(tarPath)) as unknown as ReadableStream<Uint8Array>;

        return new NextResponse(fileStream, {
            headers: {
                'Content-Type': 'application/gzip',
                'Content-Disposition': `attachment; filename="volume-data.tar.gz"`,
                'Content-Length': fileSize.toString(),
            },
        });
    } catch (error) {
        console.error('Error while downloading data:', error);
        return new Response((error as Error)?.message ?? 'An unknown error occured.', { status: 500 });
    }
}
