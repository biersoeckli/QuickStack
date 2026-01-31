'use server'

import backupService from "@/server/services/standalone-services/backup.service";
import { isAuthorizedForBackups, simpleAction } from "@/server/utils/action-wrapper.utils";
import { ServerActionResult, SuccessActionResult } from "@/shared/model/server-action-error-return.model";
import { z } from "zod";

export const downloadBackup = async (s3TargetId: string, s3Key: string) =>
    simpleAction(async () => {
        await isAuthorizedForBackups();

        const validatetData = z.object({
            s3TargetId: z.string(),
            s3Key: z.string()
        }).parse({
            s3TargetId,
            s3Key
        });

        const fileNameOfDownloadedFile = await backupService.downloadBackupForS3TargetAndKey(validatetData.s3TargetId, validatetData.s3Key);
        return new SuccessActionResult(fileNameOfDownloadedFile, 'Starting download...'); // returns the download path on the server
    }) as Promise<ServerActionResult<any, string>>;

export const deleteBackup = async (s3TargetId: string, s3Key: string) =>
    simpleAction(async () => {
        await isAuthorizedForBackups();

        const validatetData = z.object({
            s3TargetId: z.string(),
            s3Key: z.string()
        }).parse({
            s3TargetId,
            s3Key
        });

        await backupService.deleteBackupFromS3(validatetData.s3TargetId, validatetData.s3Key);
        return new SuccessActionResult(undefined, 'Backup will be deleted. Refresh the page to see the changes.');
    }) as Promise<ServerActionResult<any, string>>;