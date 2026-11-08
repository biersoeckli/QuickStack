'use server'

import appService from "@/server/services/app.service";
import dbGateService from "@/server/services/db-tool-services/dbgate.service";
import pgAdminService from "@/server/services/db-tool-services/pgadmin.service";
import phpMyAdminService from "@/server/services/db-tool-services/phpmyadmin.service";
import { isAuthorizedReadForApp, isAuthorizedWriteForApp, simpleAction } from "@/server/utils/action-wrapper.utils";
import { AppTemplateUtils } from "@/server/utils/app-template.utils";
import { DatabaseTemplateInfoModel } from "@/shared/model/database-template-info.model";
import { ServerActionResult, SuccessActionResult } from "@/shared/model/server-action-error-return.model";
import { ServiceException } from "@/shared/model/service.exception.model";

export type DbToolIds = 'dbgate' | 'phpmyadmin' | 'pgadmin';

const dbToolClasses = new Map([
    ['dbgate', dbGateService],
    ['phpmyadmin', phpMyAdminService],
    ['pgadmin', pgAdminService]
])

export const getDatabaseCredentials = async (appId: string) =>
    simpleAction(async () => {
        await isAuthorizedReadForApp(appId);
        const app = await appService.getExtendedById(appId);
        const credentials = AppTemplateUtils.getDatabaseModelFromApp(app);
        return new SuccessActionResult(credentials);
    }) as Promise<ServerActionResult<unknown, DatabaseTemplateInfoModel>>;

export const getIsDbToolActive = async (appId: string, dbTool: DbToolIds) =>
    simpleAction(async () => {
        await isAuthorizedWriteForApp(appId);
        if (!dbToolClasses.has(dbTool)) {
            throw new ServiceException('Unknown db tool');
        }
        const isActive = dbToolClasses.get(dbTool)!.isDbToolRunning(appId);
        return new SuccessActionResult(isActive);
    }) as Promise<ServerActionResult<unknown, boolean>>;

export const deployDbTool = async (appId: string, dbTool: DbToolIds) =>
    simpleAction(async () => {
        await isAuthorizedWriteForApp(appId);

        const currentDbTool = dbToolClasses.get(dbTool);
        if (!currentDbTool) {
            throw new ServiceException('Unknown db tool');
        }
        await currentDbTool.deploy(appId);
        return new SuccessActionResult();

    }) as Promise<ServerActionResult<unknown, void>>;

export const getLoginCredentialsForRunningDbTool = async (appId: string, dbTool: DbToolIds) =>
    simpleAction(async () => {
        await isAuthorizedWriteForApp(appId);

        const currentDbTool = dbToolClasses.get(dbTool);
        if (!currentDbTool) {
            throw new ServiceException('Unknown db tool');
        }
        return new SuccessActionResult(await currentDbTool.getLoginCredentialsForRunningDbGate(appId));

    }) as Promise<ServerActionResult<unknown, { url: string; username: string, password: string }>>;

export const deleteDbToolDeploymentForAppIfExists = async (appId: string, dbTool: DbToolIds) =>
    simpleAction(async () => {
        await isAuthorizedWriteForApp(appId);

        const currentDbTool = dbToolClasses.get(dbTool);
        if (!currentDbTool) {
            throw new ServiceException('Unknown db tool');
        }
        await currentDbTool.deleteToolForAppIfExists(appId);
        return new SuccessActionResult();

    }) as Promise<ServerActionResult<unknown, void>>;

export const downloadDbGateFilesForApp = async (appId: string) =>
    simpleAction(async () => {
        await isAuthorizedWriteForApp(appId);
        const url = await dbGateService.downloadDbGateFilesForApp(appId);
        return new SuccessActionResult(url);
    }) as Promise<ServerActionResult<unknown, string>>;