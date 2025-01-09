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
import fileBrowserService from "@/server/services/file-browser-service";
import monitoringService from "@/server/services/monitoring.service";

const actionAppVolumeEditZodModel = appVolumeEditZodModel.merge(z.object({
    appId: z.string(),
    id: z.string().nullish()
}));

export const restoreVolumeFromZip = async (prevState: any, inputData: FormData, volumeId: string) =>
    simpleAction(async () => {
        await getAuthUserSession();
        const validatedData = volumeUploadZodModel.parse({
            volumeId,
            file: ''
        });

        const file = inputData.get('file') as File;
        if (!file) {
            throw new ServiceException('No file provided');
        }
        await restoreService.restore(file, validatedData.volumeId);
        return new SuccessActionResult();
    });

export const saveVolume = async (prevState: any, inputData: z.infer<typeof actionAppVolumeEditZodModel>) =>
    saveFormAction(inputData, actionAppVolumeEditZodModel, async (validatedData) => {
        await getAuthUserSession();
        const existingApp = await appService.getExtendedById(validatedData.appId);
        const existingVolume = validatedData.id ? await appService.getVolumeById(validatedData.id) : undefined;
        if (existingVolume && existingVolume.size > validatedData.size) {
            throw new ServiceException('Volume size cannot be decreased');
        }
        if (existingApp.replicas > 1 && validatedData.accessMode === 'ReadWriteOnce') {
            throw new ServiceException('Volume access mode must be ReadWriteMany because your app has more than one replica configured.');
        }
        await appService.saveVolume({
            ...validatedData,
            id: validatedData.id ?? undefined,
            accessMode: existingVolume?.accessMode ?? validatedData.accessMode as string
        });
    });

export const deleteVolume = async (volumeId: string) =>
    simpleAction(async () => {
        await getAuthUserSession();
        await appService.deleteVolumeById(volumeId);
        return new SuccessActionResult(undefined, 'Successfully deleted volume');
    });

export const getPvcUsage = async (appId: string, projectId: string) =>
    simpleAction(async () => {
        await getAuthUserSession();
        return monitoringService.getPvcUsageFromApp(appId, projectId);
    }) as Promise<ServerActionResult<any, { pvcName: string, usedBytes: number }[]>>;

export const downloadPvcData = async (volumeId: string) =>
    simpleAction(async () => {
        await getAuthUserSession();
        const fileNameOfDownloadedFile = await pvcService.downloadPvcData(volumeId);
        return new SuccessActionResult(fileNameOfDownloadedFile, 'Successfully zipped volume data'); // returns the download path on the server
    }) as Promise<ServerActionResult<any, string>>;

const actionAppFileMountEditZodModel = fileMountEditZodModel.merge(z.object({
    appId: z.string(),
    id: z.string().nullish()
}));

export const saveFileMount = async (prevState: any, inputData: z.infer<typeof actionAppFileMountEditZodModel>) =>
    saveFormAction(inputData, actionAppFileMountEditZodModel, async (validatedData) => {
        await getAuthUserSession();
        await appService.saveFileMount({
            ...validatedData,
            id: validatedData.id ?? undefined,
        });
    });

export const deleteFileMount = async (fileMountId: string) =>
    simpleAction(async () => {
        await getAuthUserSession();
        await appService.deleteFileMountById(fileMountId);
        return new SuccessActionResult(undefined, 'Successfully deleted volume');
    });

export const saveBackupVolume = async (prevState: any, inputData: VolumeBackupEditModel) =>
    saveFormAction(inputData, volumeBackupEditZodModel, async (validatedData) => {
        await getAuthUserSession();
        if (validatedData.retention < 1) {
            throw new ServiceException('Retention must be at least 1');
        }
        const savedVolumeBackup = await volumeBackupService.save({
            ...validatedData,
            id: validatedData.id ?? undefined,
        });
        await backupService.registerAllBackups();
        return new SuccessActionResult();
    });

export const deleteBackupVolume = async (backupVolumeId: string) =>
    simpleAction(async () => {
        await getAuthUserSession();
        await volumeBackupService.deleteById(backupVolumeId);
        await backupService.registerAllBackups();
        return new SuccessActionResult(undefined, 'Successfully deleted backup schedule');
    });

export const runBackupVolumeSchedule = async (backupVolumeId: string) =>
    simpleAction(async () => {
        await getAuthUserSession();
        await backupService.runBackupForVolume(backupVolumeId);
        return new SuccessActionResult(undefined, 'Backup created and uploaded successfully');
    });

export const openFileBrowserForVolume = async (volumeId: string) =>
    simpleAction(async () => {
        await getAuthUserSession();
        const fileBrowserDomain = await fileBrowserService.deployFileBrowserForVolume(volumeId);
        return new SuccessActionResult(fileBrowserDomain, 'File browser started successfully');
    }) as Promise<ServerActionResult<any, {
        url: string;
        password: string;
    }>>;