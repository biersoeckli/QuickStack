'use server'

import { getAuthUserSession, isAuthorizedWriteForWorkload, saveFormAction, workloadExecutor } from "@/server/utils/action-wrapper.utils";
import { simpleAction } from "@/server/utils/action-wrapper.utils";
import { HostnameDnsProviderUtils } from "@/shared/utils/domain-dns-provider.utils";
import { ServiceException } from "@/shared/model/service.exception.model";
import paramService, { ParamService } from "@/server/services/param.service";
import { DomainEditModel, domainEditZodModel } from "@/shared/model/domain-edit.model";
import { WorkloadType } from "@/shared/model/runtime-type.model";
import appService from "@/server/services/app.service";
import agentDomainService from "@/server/services/agent-domain.service";
import { FileMountEditModel, fileMountEditZodModel } from "@/shared/model/file-mount-edit.model";
import agentFileMountService from "@/server/services/agent-file-mount.service";
import dataAccess from "@/server/adapter/db.client";
import { z } from "zod";

export const getQuickstackDomainSuffix = async () => simpleAction(async () => {
    await getAuthUserSession();
    const publicIpv4 = await paramService.getString(ParamService.PUBLIC_IPV4_ADDRESS);
    if (!publicIpv4) {
        throw new ServiceException('Please set the main public IPv4 address in the QuickStack settings first.');
    }
    return HostnameDnsProviderUtils.getHexHostnameForIpAddress(publicIpv4);
});


export const saveDomain = async (prevState: any, inputData: DomainEditModel, workloadId: string, type: WorkloadType) =>
    saveFormAction(inputData, domainEditZodModel, async (validatedData) => {
        await isAuthorizedWriteForWorkload(workloadId);

        if (validatedData.hostname.includes('://')) {
            const url = new URL(validatedData.hostname);
            validatedData.hostname = url.hostname;
        }

        if (HostnameDnsProviderUtils.containsDnsProviderHostname(validatedData.hostname)) {
            if (!HostnameDnsProviderUtils.isValidDnsProviderHostname(validatedData.hostname)) {
                throw new ServiceException(`Invalid ${HostnameDnsProviderUtils.PROVIDER_HOSTNAME} domain. Subdomain of ${HostnameDnsProviderUtils.PROVIDER_HOSTNAME} cannot contain dots.`);
            }
        }

        await workloadExecutor(type, {
            app: () => appService.saveDomain({
                appId: workloadId,
                ...validatedData
            }),
            agent: () => agentDomainService.saveDomain({
                agentId: workloadId,
                ...validatedData
            })
        });
    });

export const deleteDomain = async (domainId: string, type: WorkloadType) =>
    simpleAction(async () => {
        await isAuthorizedWriteForWorkload(domainId);

        await workloadExecutor(type, {
            app: async () => {
                const domain = await appService.getDomainById(domainId);
                await isAuthorizedWriteForWorkload(domain.appId);
                appService.deleteDomainById(domainId)
            },
            agent: async () => {
                const domain = await agentDomainService.getDomainById(domainId);
                await isAuthorizedWriteForWorkload(domain.agentId);
                await agentDomainService.deleteDomain(domainId);
            }
        });
    });

const actionFileMountEditZodModel = fileMountEditZodModel.merge(z.object({
    workloadId: z.string(),
}));

export const saveFileMount = async (prevState: any, inputData: FileMountEditModel & { workloadId: string }, type: WorkloadType) =>
    saveFormAction(inputData, actionFileMountEditZodModel, async (validatedData) => {
        await isAuthorizedWriteForWorkload(validatedData.workloadId);

        const { workloadId, ...fileMountData } = validatedData;
        await workloadExecutor(type, {
            app: () => appService.saveFileMount({
                appId: validatedData.workloadId,
                ...fileMountData,
            }),
            agent: () => agentFileMountService.saveFileMount({
                agentId: validatedData.workloadId,
                ...fileMountData,
            })
        });
    });

export const deleteFileMount = async (fileMountId: string, type: WorkloadType) =>
    simpleAction(async () => {
        await workloadExecutor(type, {
            app: async () => {
                const fileMount = await appService.getFileMountById(fileMountId);
                await isAuthorizedWriteForWorkload(fileMount.appId);
                await appService.deleteFileMountById(fileMountId);
            },
            agent: async () => {
                const fileMount = await agentFileMountService.getById(fileMountId);
                await isAuthorizedWriteForWorkload(fileMount.agentId);
                await agentFileMountService.deleteFileMount(fileMountId);
            }
        });
    });
