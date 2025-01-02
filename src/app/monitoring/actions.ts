'use server'

import clusterService from "@/server/services/node.service";
import { getAuthUserSession, simpleAction } from "@/server/utils/action-wrapper.utils";
import { NodeResourceModel } from "@/shared/model/node-resource.model";
import { ServerActionResult } from "@/shared/model/server-action-error-return.model";

export const getNodeResourceUsage = async () =>
    simpleAction(async () => {
        await getAuthUserSession();
        return await clusterService.getNodeResourceUsage();
    }) as Promise<ServerActionResult<unknown, NodeResourceModel[]>>;