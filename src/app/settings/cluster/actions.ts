'use server'

import { getAdminUserSession, getAuthUserSession, simpleAction } from "@/server/utils/action-wrapper.utils";
import { SuccessActionResult } from "@/shared/model/server-action-error-return.model";
import clusterService from "@/server/services/node.service";

export const setNodeStatus = async (nodeName: string, schedulable: boolean) =>
  simpleAction(async () => {
    await getAdminUserSession();
    await clusterService.setNodeStatus(nodeName, schedulable);
    return new SuccessActionResult(undefined, 'Successfully updated node status.');
  });
