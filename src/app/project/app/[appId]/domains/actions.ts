'use server'

import { AppPortModel, appPortZodModel } from "@/shared/model/default-port.model";
import { domainEditZodModel } from "@/shared/model/domain-edit.model";
import { nodePortEditZodModel } from "@/shared/model/node-port-edit.model";
import { SuccessActionResult } from "@/shared/model/server-action-error-return.model";
import appService from "@/server/services/app.service";
import { getAuthUserSession, isAuthorizedWriteForApp, saveFormAction, simpleAction } from "@/server/utils/action-wrapper.utils";
import { z } from "zod";
import { HostnameDnsProviderUtils } from "@/shared/utils/domain-dns-provider.utils";
import { ServiceException } from "@/shared/model/service.exception.model";
import paramService, { ParamService } from "@/server/services/param.service";

export const savePort = async (prevState: any, inputData: AppPortModel, appId: string, portId?: string) =>
    saveFormAction(inputData, appPortZodModel, async (validatedData) => {
        await isAuthorizedWriteForApp(appId);
        await appService.savePort({
            ...validatedData,
            id: portId ?? undefined,
            appId
        });
    });

export const deletePort = async (portId: string) =>
    simpleAction(async () => {
        await isAuthorizedWriteForApp(await appService.getPortById(portId).then(p => p.appId));
        await appService.deletePortById(portId);
        return new SuccessActionResult(undefined, 'Successfully deleted port');
    });

export const getQuickstackDomainSuffix = async () => simpleAction(async () => {
    await getAuthUserSession();
    const publicIpv4 = await paramService.getString(ParamService.PUBLIC_IPV4_ADDRESS);
    if (!publicIpv4) {
        throw new ServiceException('Please set the main public IPv4 address in the QuickStack settings first.');
    }
    return HostnameDnsProviderUtils.getHexHostnameForIpAddress(publicIpv4);
});

const actionNodePortEditZodModel = nodePortEditZodModel.extend({
    appId: z.string(),
    id: z.string().nullish(),
});

export const saveNodePort = async (prevState: any, inputData: z.infer<typeof actionNodePortEditZodModel>) =>
    saveFormAction(inputData, actionNodePortEditZodModel, async (validatedData) => {
        await isAuthorizedWriteForApp(validatedData.appId);
        await appService.saveNodePort({
            ...validatedData,
            id: validatedData.id ?? undefined,
        });
    });

export const deleteNodePort = async (nodePortId: string) =>
    simpleAction(async () => {
        await isAuthorizedWriteForApp(await appService.getNodePortById(nodePortId).then(np => np.appId));
        await appService.deleteNodePortById(nodePortId);
        return new SuccessActionResult(undefined, 'Successfully deleted node port');
    });
