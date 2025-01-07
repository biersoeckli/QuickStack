'use server'

import { appVolumeEditZodModel } from "@/shared/model/volume-edit.model";
import { ServerActionResult, SuccessActionResult } from "@/shared/model/server-action-error-return.model";
import appService from "@/server/services/app.service";
import { getAuthUserSession, saveFormAction, simpleAction } from "@/server/utils/action-wrapper.utils";
import { z } from "zod";
import { ServiceException } from "@/shared/model/service.exception.model";
import pvcService from "@/server/services/pvc.service";
import { fileMountEditZodModel } from "@/shared/model/file-mount-edit.model";
import { VolumeBackupEditModel, volumeBackupEditZodModel } from "@/shared/model/backup-volume-edit.model";
import volumeBackupService from "@/server/services/volume-backup.service";
import backupService from "@/server/services/standalone-services/backup.service";
import { volumeUploadZodModel } from "@/shared/model/volume-upload.model";
import restoreService from "@/server/services/restore.service";
import { BasicAuthEditModel, basicAuthEditZodModel } from "@/shared/model/basic-auth-edit.model";


export const saveBasicAuth = async (prevState: any, inputData: BasicAuthEditModel) =>
    saveFormAction(inputData, basicAuthEditZodModel, async (validatedData) => {
        await getAuthUserSession();

        await appService.saveBasicAuth({
            ...validatedData,
            id: validatedData.id ?? undefined
        });

        return new SuccessActionResult();
    });

export const deleteBasicAuth = async (basicAuthId: string) =>
    simpleAction(async () => {
        await getAuthUserSession();
        await appService.deleteBasicAuthById(basicAuthId);
        return new SuccessActionResult(undefined, 'Successfully deleted item');
    });
