'use server'

import { SuccessActionResult } from "@/shared/model/server-action-error-return.model";
import appService from "@/server/services/app.service";
import buildService from "@/server/services/build.service";
import deploymentService from "@/server/services/deployment.service";
import monitoringService from "@/server/services/monitoring.service";
import podService from "@/server/services/pod.service";
import { isAuthorizedReadForApp, isAuthorizedWriteForApp, simpleAction } from "@/server/utils/action-wrapper.utils";
import appLogsService from "@/server/services/standalone-services/app-logs.service";
import { ServiceException } from "@/shared/model/service.exception.model";

export const getDeploymentsAndBuildsForApp = async (appId: string) =>
    simpleAction(async () => {
        await isAuthorizedReadForApp(appId);
        const app = await appService.getExtendedById(appId);
        return await deploymentService.getDeploymentHistory(app.projectId, appId);
    });

export const deleteBuild = async (buildName: string) =>
    simpleAction(async () => {
        await isAuthorizedWriteForApp(await buildService.getAppIdByBuildName(buildName));
        await buildService.deleteBuild(buildName);
        return new SuccessActionResult(undefined, 'Successfully stopped and deleted build.');
    });

export const getPodsForApp = async (appId: string) =>
    simpleAction(async () => {
        await isAuthorizedReadForApp(appId);
        const app = await appService.getExtendedById(appId);
        return await podService.getPodsForApp(app.projectId, appId);
    });

export const getRessourceDataApp = async (projectId: string, appId: string) =>
    simpleAction(async () => {
        await isAuthorizedReadForApp(appId);
        return await monitoringService.getMonitoringForApp(projectId, appId);
    });

export const createNewWebhookUrl = async (appId: string) =>
    simpleAction(async () => {
        await isAuthorizedWriteForApp(appId);
        await appService.regenerateWebhookId(appId);
    });

export const getDownloadableLogs = async (appId: string) =>
    simpleAction(async () => {
        await isAuthorizedReadForApp(appId);
        return new SuccessActionResult(await appLogsService.getAvailableLogsForApp(appId));
    });

export const exportLogsToFileForToday = async (appId: string) =>
    simpleAction(async () => {
        await isAuthorizedReadForApp(appId);
        const result = await appLogsService.writeAppLogsToDiskForApp(appId);
        if (!result) {
            throw new ServiceException('There are no logs available for today.');
        }
        return new SuccessActionResult(result);
    });