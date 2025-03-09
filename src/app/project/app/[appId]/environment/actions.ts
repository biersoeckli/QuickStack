'use server'

import { AppEnvVariablesModel, appEnvVariablesZodModel } from "@/shared/model/env-edit.model";
import appService from "@/server/services/app.service";
import { getAuthUserSession, isAuthorizedWriteForApp, saveFormAction } from "@/server/utils/action-wrapper.utils";


export const saveEnvVariables = async (prevState: any, inputData: AppEnvVariablesModel, appId: string) =>
    saveFormAction(inputData, appEnvVariablesZodModel, async (validatedData) => {
        await isAuthorizedWriteForApp(appId);
        const existingApp = await appService.getById(appId);
        await appService.save({
            ...existingApp,
            ...validatedData,
            id: appId,
        });
    });