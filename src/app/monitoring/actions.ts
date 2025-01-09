'use server'

import monitoringService from "@/server/services/monitoring.service";
import clusterService from "@/server/services/node.service";
import { getAuthUserSession, simpleAction } from "@/server/utils/action-wrapper.utils";
import { AppMonitoringUsageModel } from "@/shared/model/app-monitoring-usage.model";
import { AppVolumeMonitoringUsageModel } from "@/shared/model/app-volume-monitoring-usage.model";
import { NodeResourceModel } from "@/shared/model/node-resource.model";
import { ServerActionResult } from "@/shared/model/server-action-error-return.model";

export const getNodeResourceUsage = async () =>
    simpleAction(async () => {
        await getAuthUserSession();
        return await clusterService.getNodeResourceUsage();
    }) as Promise<ServerActionResult<unknown, NodeResourceModel[]>>;

export const getVolumeMonitoringUsage = async () =>
    simpleAction(async () => {
        await getAuthUserSession();
        return await monitoringService.getAllAppVolumesUsage();
    }) as Promise<ServerActionResult<unknown, AppVolumeMonitoringUsageModel[]>>;

export const getMonitoringForAllApps = async () =>
    simpleAction(async () => {
        await getAuthUserSession();
        return await monitoringService.getMonitoringForAllApps();
    }) as Promise<ServerActionResult<unknown, AppMonitoringUsageModel[]>>;