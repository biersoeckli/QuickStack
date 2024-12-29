'use server'

import appService from "@/server/services/app.service";
import { getAuthUserSession, simpleAction } from "@/server/utils/action-wrapper.utils";
import { AppTemplateUtils } from "@/server/utils/app-template.utils";
import { DatabaseTemplateInfoModel } from "@/shared/model/database-template-info.model";
import { ServerActionResult, SuccessActionResult } from "@/shared/model/server-action-error-return.model";

export const getDatabaseCredentials = async (appId: string) =>
    simpleAction(async () => {
        await getAuthUserSession();
        const app = await appService.getExtendedById(appId);
        const credentials = AppTemplateUtils.getDatabaseModelFromApp(app);
        return new SuccessActionResult(credentials);
    }) as Promise<ServerActionResult<unknown, DatabaseTemplateInfoModel>>;