'use server'

import { AppRateLimitsModel, appRateLimitsZodModel } from "@/shared/model/app-rate-limits.model";
import { appSourceInfoContainerZodModel, appSourceInfoGitZodModel, AppSourceInfoInputModel } from "@/shared/model/app-source-info.model";
import { ServerActionResult } from "@/shared/model/server-action-error-return.model";
import { ServiceException } from "@/shared/model/service.exception.model";
import appService from "@/server/services/app.service";
import { isAuthorizedWriteForApp, saveFormAction, simpleAction } from "@/server/utils/action-wrapper.utils";
import { appContainerConfigZodModel } from "@/shared/model/app-container-config.model";
import { AppContainerConfigInputModel } from "./app-container-config";


export const saveGeneralAppSourceInfo = async (prevState: any, inputData: AppSourceInfoInputModel, appId: string) => {
    if (inputData.sourceType === 'GIT') {
        return saveFormAction(inputData, appSourceInfoGitZodModel, async (validatedData) => {
            await isAuthorizedWriteForApp(appId);
            const existingApp = await appService.getById(appId);
            await appService.save({
                ...existingApp,
                ...validatedData,
                sourceType: 'GIT',
                id: appId,
            });
        });
    } else if (inputData.sourceType === 'CONTAINER') {
        return saveFormAction(inputData, appSourceInfoContainerZodModel, async (validatedData) => {
            await isAuthorizedWriteForApp(appId);
            const existingApp = await appService.getById(appId);
            await appService.save({
                ...existingApp,
                ...validatedData,
                sourceType: 'CONTAINER',
                id: appId,
            });
        });
    } else {
        return simpleAction(async () => new ServerActionResult('error', undefined, 'Invalid Source Type', undefined));
    }
};

export const saveGeneralAppRateLimits = async (prevState: any, inputData: AppRateLimitsModel, appId: string) =>
    saveFormAction(inputData, appRateLimitsZodModel, async (validatedData) => {
        if (validatedData.replicas < 1) {
            throw new ServiceException('Replica Count must be at least 1');
        }
        await isAuthorizedWriteForApp(appId);

        const extendedApp = await appService.getExtendedById(appId);
        if (extendedApp.appVolumes.some(v => v.accessMode === 'ReadWriteOnce') && validatedData.replicas > 1) {
            throw new ServiceException('Replica Count must be 1 because you have at least one volume with access mode ReadWriteOnce.');
        }

        const existingApp = await appService.getById(appId);
        await appService.save({
            ...existingApp,
            ...validatedData,
            id: appId,
        });
    });

export const saveGeneralAppContainerConfig = async (prevState: any, inputData: AppContainerConfigInputModel, appId: string) =>
    saveFormAction(inputData, appContainerConfigZodModel, async (validatedData) => {
        await isAuthorizedWriteForApp(appId);
        const existingApp = await appService.getById(appId);

        // Convert args array to JSON string for storage
        const containerArgsJson = validatedData.containerArgs && validatedData.containerArgs.length > 0
            ? JSON.stringify(validatedData.containerArgs.map(arg => arg.value))
            : null;

        await appService.save({
            ...existingApp,
            containerCommand: validatedData.containerCommand?.trim() || null,
            containerArgs: containerArgsJson,
            id: appId,
        });
    });
