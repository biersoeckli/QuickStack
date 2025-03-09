'use server'

import { AppPortModel, appPortZodModel } from "@/shared/model/default-port.model";
import { appDomainEditZodModel } from "@/shared/model/domain-edit.model";
import { SuccessActionResult } from "@/shared/model/server-action-error-return.model";
import appService from "@/server/services/app.service";
import { getAuthUserSession, isAuthorizedWriteForApp, saveFormAction, simpleAction } from "@/server/utils/action-wrapper.utils";
import { z } from "zod";
import { TraefikMeUtils } from "@/shared/utils/traefik-me.utils";
import { ServiceException } from "@/shared/model/service.exception.model";

const actionAppDomainEditZodModel = appDomainEditZodModel.merge(z.object({
    appId: z.string(),
    id: z.string().nullish()
}));

export const saveDomain = async (prevState: any, inputData: z.infer<typeof actionAppDomainEditZodModel>) =>
    saveFormAction(inputData, actionAppDomainEditZodModel, async (validatedData) => {
        await isAuthorizedWriteForApp(validatedData.appId);

        if (validatedData.hostname.includes('://')) {
            const url = new URL(validatedData.hostname);
            validatedData.hostname = url.hostname;
        }

        if (TraefikMeUtils.containesTraefikMeDomain(validatedData.hostname)) {
            if (!TraefikMeUtils.isValidTraefikMeDomain(validatedData.hostname)) {
                throw new ServiceException('Invalid traefik.me domain. Subdomain of traefik.me cannot contain dots.');
            }
        }

        await appService.saveDomain({
            ...validatedData,
            id: validatedData.id ?? undefined
        });
    });

export const deleteDomain = async (domainId: string) =>
    simpleAction(async () => {
        await isAuthorizedWriteForApp(await appService.getDomainById(domainId).then(d => d.appId));
        await appService.deleteDomainById(domainId);
        return new SuccessActionResult(undefined, 'Successfully deleted domain');
    });

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