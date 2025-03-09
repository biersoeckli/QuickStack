
import { FsUtils } from "@/server/utils/fs.utils";
import { PathUtils } from "@/server/utils/path.utils";
import { NextRequest, NextResponse } from "next/server";
import fs from 'fs/promises';
import { getAuthUserSession, isAuthorizedReadForApp } from "@/server/utils/action-wrapper.utils";
import { ServiceException } from "@/shared/model/service.exception.model";
import { z } from "zod";
import { stringToDate } from "@/shared/utils/zod.utils";

// Prevents this route's response from being cached
export const dynamic = "force-dynamic";

const zodInputModel = z.object({
    appId: z.string().min(1),
    date: stringToDate
});

export async function GET(request: NextRequest) {
    try {
        await getAuthUserSession();

        const requestUrl = new URL(request.url);
        const appId = requestUrl.searchParams.get('appId');
        const date = requestUrl.searchParams.get('date');
        const validatedData = zodInputModel.parse({ appId, date });

        await isAuthorizedReadForApp(validatedData.appId);

        const logsPath = PathUtils.appLogsFile(validatedData.appId, validatedData.date);
        if (!await FsUtils.fileExists(logsPath)) {
            throw new ServiceException(`Could not find logs for ${appId}.`);
        }

        const buffer = await fs.readFile(logsPath);

        return new NextResponse(buffer, {
            headers: {
                'Content-Type': 'application/gzip',
                'Content-Disposition':
                    `attachment; filename="${appId}-${validatedData.date.toISOString().split('T')[0]}.tar.gz"`,
            },
        });
    } catch (error) {
        console.error('Error while downloading data:', error);
        return new Response((error as Error)?.message ?? 'An unknown error occured.', { status: 500 });
    }
}