'use server'

import { SuccessActionResult } from "@/shared/model/server-action-error-return.model";
import appService from "@/server/services/app.service";
import { getAuthUserSession, saveFormAction, simpleAction } from "@/server/utils/action-wrapper.utils";
import { z } from "zod";
import appTemplateService from "@/server/services/app-template.service";
import { AppTemplateModel, appTemplateZodModel } from "@/shared/model/app-template.model";

const createAppSchema = z.object({
    appName: z.string().min(1)
});

export const createApp = async (appName: string, projectId: string, appId?: string) =>
    saveFormAction({ appName }, createAppSchema, async (validatedData) => {
        await getAuthUserSession();

        const returnData = await appService.save({
            id: appId ?? undefined,
            name: validatedData.appName,
            projectId
        });

        return new SuccessActionResult(returnData, "App created successfully.");
    });

export const createAppFromTemplate = async(prevState: any, inputData: AppTemplateModel, projectId: string) =>
    saveFormAction(inputData, appTemplateZodModel, async (validatedData) => {
        await getAuthUserSession();
        await appTemplateService.createAppFromTemplate(projectId, validatedData);
        return new SuccessActionResult(undefined, "App created successfully.");
    });

export const deleteApp = async (appId: string) =>
    simpleAction(async () => {
        await getAuthUserSession();
        await appService.deleteById(appId);
        return new SuccessActionResult(undefined, "App deleted successfully.");
    });