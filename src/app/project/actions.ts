'use server'

import { getAuthUserSession, isAuthorizedWriteForWorkload, saveFormAction, workloadExecutor } from "@/server/utils/action-wrapper.utils";
import { simpleAction } from "@/server/utils/action-wrapper.utils";
import { HostnameDnsProviderUtils } from "@/shared/utils/domain-dns-provider.utils";
import { ServiceException } from "@/shared/model/service.exception.model";
import paramService, { ParamService } from "@/server/services/param.service";
import { DomainEditModel, domainEditZodModel } from "@/shared/model/domain-edit.model";
import { WorkloadType, zodWorkloadType } from "@/shared/model/runtime-type.model";
import { ensureWriteProjectWorkload } from "@/server/utils/shared-authorization.utils";
import appService from "@/server/services/app.service";
import agentDomainService from "@/server/services/agent-domain.service";

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
            app: () => appService.deleteDomainById(domainId),
            agent: () => agentDomainService.deleteDomain(domainId)
        });
    });