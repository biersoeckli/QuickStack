'use server'

import { SuccessActionResult } from "@/shared/model/server-action-error-return.model";
import appService from "@/server/services/app.service";
import buildService from "@/server/services/build.service";
import deploymentService from "@/server/services/deployment.service";
import monitoringService from "@/server/services/monitoring.service";
import podService from "@/server/services/pod.service";
import { isAuthorizedReadForApp, isAuthorizedWriteForApp, isAuthorizedWriteForWorkload, simpleAction } from "@/server/utils/action-wrapper.utils";

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

export const rollbackToDeployment = async (appId: string, deploymentId: string) =>
    simpleAction(async () => {
        await isAuthorizedWriteForApp(appId);
        await appService.rollbackToDeployment(appId, deploymentId);
        return new SuccessActionResult(undefined, 'Successfully started rollback.');
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
        await isAuthorizedWriteForWorkload(appId);
       return  await appService.regenerateWebhookId(appId);
    });
