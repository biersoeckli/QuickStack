'use server'

import buildService from "@/server/services/build.service";
import { getAuthUserSession, isAuthorizedWriteForApp, simpleAction } from "@/server/utils/action-wrapper.utils";
import { SuccessActionResult } from "@/shared/model/server-action-error-return.model";
import { UserGroupUtils } from "@/shared/utils/role.utils";

export const getAllBuildsAction = async () =>
    simpleAction(async () => {
        const session = await getAuthUserSession();
        const builds = await buildService.getAllBuilds();
        return builds.filter((build) => UserGroupUtils.sessionHasReadAccessForApp(session, build.appId));
    });

export const deleteBuildAction = async (buildName: string) =>
    simpleAction(async () => {
        await isAuthorizedWriteForApp(await buildService.getAppIdByBuildName(buildName));
        await buildService.deleteBuild(buildName);
        return new SuccessActionResult(undefined, 'Successfully stopped and deleted build.');
    });
