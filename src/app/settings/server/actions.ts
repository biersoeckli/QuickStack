'use server'

import { getAuthUserSession, saveFormAction, simpleAction } from "@/server/utils/action-wrapper.utils";
import paramService, { ParamService } from "@/server/services/param.service";
import { QsIngressSettingsModel, qsIngressSettingsZodModel } from "@/shared/model/qs-settings.model";
import { QsLetsEncryptSettingsModel, qsLetsEncryptSettingsZodModel } from "@/shared/model/qs-letsencrypt-settings.model";
import quickStackService from "@/server/services/qs.service";
import { ServerActionResult, SuccessActionResult } from "@/shared/model/server-action-error-return.model";
import registryService from "@/server/services/registry.service";
import { StringUtils } from "@/shared/utils/string.utils";

export const updateIngressSettings = async (prevState: any, inputData: QsIngressSettingsModel) =>
  saveFormAction(inputData, qsIngressSettingsZodModel, async (validatedData) => {
    await getAuthUserSession();

    const url = new URL(validatedData.serverUrl.includes('://') ? validatedData.serverUrl : `https://${validatedData.serverUrl}`);

    await paramService.save({
      name: ParamService.QS_SERVER_HOSTNAME,
      value: url.hostname
    });

    await paramService.save({
      name: ParamService.DISABLE_NODEPORT_ACCESS,
      value: validatedData.disableNodePortAccess + ''
    });

    await quickStackService.createOrUpdateService(!validatedData.disableNodePortAccess);
    await quickStackService.createOrUpdateIngress(validatedData.serverUrl);
  });

export const updateLetsEncryptSettings = async (prevState: any, inputData: QsLetsEncryptSettingsModel) =>
  saveFormAction(inputData, qsLetsEncryptSettingsZodModel, async (validatedData) => {
    await getAuthUserSession();

    await paramService.save({
      name: ParamService.LETS_ENCRYPT_MAIL,
      value: validatedData.letsEncryptMail
    });

    await quickStackService.createOrUpdateCertIssuer(validatedData.letsEncryptMail);
  });

export const getConfiguredHostname: () => Promise<ServerActionResult<unknown, string | undefined>> = async () =>
  simpleAction(async () => {
    await getAuthUserSession();

    return await paramService.getString(ParamService.QS_SERVER_HOSTNAME);
  });

export const updateQuickstack = async () =>
  simpleAction(async () => {
    await getAuthUserSession();
    const useCaranyChannel = await paramService.getBoolean(ParamService.USE_CANARY_CHANNEL, false);
    await quickStackService.updateQuickStack(useCaranyChannel);
    return new SuccessActionResult(undefined, 'QuickStack will be updated, refresh the page in a few seconds.');
  });

export const updateRegistry = async () =>
  simpleAction(async () => {
    await getAuthUserSession();
    await registryService.deployRegistry(true);
    return new SuccessActionResult(undefined, 'Registry will be updated, this might take a few seconds.');
  });

export const purgeRegistryImages = async () =>
  simpleAction(async () => {
    await getAuthUserSession();
    const deletedSize = await registryService.purgeRegistryImages();
    return new SuccessActionResult(undefined, `Successfully purged ${StringUtils.convertBytesToReadableSize(deletedSize)} of images.`);
  });

export const setCanaryChannel = async (useCanaryChannel: boolean) =>
  simpleAction(async () => {
    await getAuthUserSession();
    await paramService.save({
      name: ParamService.USE_CANARY_CHANNEL,
      value: !!useCanaryChannel ? 'true' : 'false'
    });
    return new SuccessActionResult(undefined, `Turned ${useCanaryChannel ? 'on' : 'off'} the canary channel.`);
  });