'use server'

import monitoringService from "@/server/services/monitoring.service";
import clusterService from "@/server/services/node.service";
import pvcService from "@/server/services/pvc.service";
import backupService from "@/server/services/standalone-services/backup.service";
import { getAuthUserSession, simpleAction } from "@/server/utils/action-wrapper.utils";
import { AppMonitoringUsageModel } from "@/shared/model/app-monitoring-usage.model";
import { AppVolumeMonitoringUsageModel } from "@/shared/model/app-volume-monitoring-usage.model";
import { NodeResourceModel } from "@/shared/model/node-resource.model";
import { ServerActionResult, SuccessActionResult } from "@/shared/model/server-action-error-return.model";
import { z } from "zod";

export const downloadBackup = async (s3TargetId: string, s3Key: string) =>
    simpleAction(async () => {
        await getAuthUserSession();

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