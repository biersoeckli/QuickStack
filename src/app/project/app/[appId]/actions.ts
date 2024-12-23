'use server'

import { SuccessActionResult } from "@/shared/model/server-action-error-return.model";
import appService from "@/server/services/app.service";
import deploymentService from "@/server/services/deployment.service";
import { getAuthUserSession, simpleAction } from "@/server/utils/action-wrapper.utils";
import eventService from "@/server/services/event.service";


export const deploy = async (appId: string, forceBuild = false) =>
    simpleAction(async () => {
        await getAuthUserSession();
        await appService.buildAndDeploy(appId, forceBuild);
        return new SuccessActionResult(undefined, 'Successfully started deployment.');
    });

export const stopApp = async (appId: string) =>
    simpleAction(async () => {
        await getAuthUserSession();
        const app = await appService.getExtendedById(appId);
        await deploymentService.setReplicasForDeployment(app.projectId, app.id, 0);
        return new SuccessActionResult(undefined, 'Successfully stopped app.');
    });

export const startApp = async (appId: string) =>
    simpleAction(async () => {
        await getAuthUserSession();
        const app = await appService.getExtendedById(appId);
        await deploymentService.setReplicasForDeployment(app.projectId, app.id, app.replicas);
        return new SuccessActionResult(undefined, 'Successfully started app.');
    });

export const getLatestAppEvents = async (appId: string) =>
    simpleAction(async () => {
        await getAuthUserSession();
        const app = await appService.getById(appId);
        return await eventService.getEventsForApp(app.projectId, app.id);
    });
