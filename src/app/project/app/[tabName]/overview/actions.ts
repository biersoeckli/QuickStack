'use server'

import { BuildJobModel } from "@/shared/model/build-job";
import { DeploymentInfoModel } from "@/shared/model/deployment-info.model";
import { PodsInfoModel } from "@/shared/model/pods-info.model";
import { ServerActionResult, SuccessActionResult } from "@/shared/model/server-action-error-return.model";
import appService from "@/server/services/app.service";
import buildService from "@/server/services/build.service";
import deploymentService from "@/server/services/deployment.service";
import podService from "@/server/services/pod.service";
import { getAuthUserSession, simpleAction } from "@/server/utils/action-wrapper.utils";


export const getDeploymentsAndBuildsForApp = async (appId: string) =>
    simpleAction(async () => {
        await getAuthUserSession();
        const app = await appService.getExtendedById(appId);
        return await deploymentService.getDeploymentHistory(app.projectId, appId);
    }) as Promise<ServerActionResult<unknown, DeploymentInfoModel[]>>;

export const deleteBuild = async (buildName: string) =>
    simpleAction(async () => {
        await getAuthUserSession();
        await buildService.deleteBuild(buildName);
        return new SuccessActionResult(undefined, 'Successfully stopped and deleted build.');
    }) as Promise<ServerActionResult<unknown, void>>;

export const getPodsForApp = async (appId: string) =>
    simpleAction(async () => {
        await getAuthUserSession();
        const app = await appService.getExtendedById(appId);
        return await podService.getPodsForApp(app.projectId, appId);
    }) as Promise<ServerActionResult<unknown, PodsInfoModel[]>>;