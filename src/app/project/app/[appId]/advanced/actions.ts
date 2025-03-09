'use server'

import { SuccessActionResult } from "@/shared/model/server-action-error-return.model";
import appService from "@/server/services/app.service";
import { isAuthorizedWriteForApp, saveFormAction, simpleAction } from "@/server/utils/action-wrapper.utils";
import { BasicAuthEditModel, basicAuthEditZodModel } from "@/shared/model/basic-auth-edit.model";


export const saveBasicAuth = async (prevState: any, inputData: BasicAuthEditModel) =>
    saveFormAction(inputData, basicAuthEditZodModel, async (validatedData) => {
        await isAuthorizedWriteForApp(validatedData.appId);

        await appService.saveBasicAuth({
            ...validatedData,
            id: validatedData.id ?? undefined
        });

        return new SuccessActionResult();
    });

export const deleteBasicAuth = async (basicAuthId: string) =>
    simpleAction(async () => {
        await isAuthorizedWriteForApp(await appService.getBasicAuthById(basicAuthId).then(b => b.appId));
        await appService.deleteBasicAuthById(basicAuthId);
        return new SuccessActionResult(undefined, 'Successfully deleted item');
    });
