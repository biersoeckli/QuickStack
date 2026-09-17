'use server'

import { ServiceException } from "@/shared/model/service.exception.model";
import { ProfilePasswordChangeModel, profilePasswordChangeZodModel } from "@/shared/model/update-password.model";
import userService from "@/server/services/user.service";
import { getAuthUserSession, saveFormAction, simpleAction } from "@/server/utils/action-wrapper.utils";
import { TotpModel, totpZodModel } from "@/shared/model/totp.model";
import { SuccessActionResult } from "@/shared/model/server-action-error-return.model";
import restApiKeyService from "@/server/services/rest-api-key.service";
import { restApiKeyCreateZodModel, RestApiKeyCreateModel } from "@/shared/model/rest-api-key.model";

export const changePassword = async (prevState: any, inputData: ProfilePasswordChangeModel) =>
  saveFormAction(inputData, profilePasswordChangeZodModel, async (validatedData) => {
    if (validatedData.newPassword !== validatedData.confirmNewPassword) {
      throw new ServiceException('New password and confirm password do not match.');
    }
    if (validatedData.oldPassword === validatedData.newPassword) {
      throw new ServiceException('New password cannot be the same as the old password.');
    }
    const session = await getAuthUserSession();
    await userService.changePassword(session.email, validatedData.oldPassword, validatedData.newPassword);
  });

export const createNewTotpToken = async () =>
  simpleAction(async () => {
    const session = await getAuthUserSession();
    const base64QrCode = await userService.createNewTotpToken(session.email);
    return base64QrCode;
  });

export const verifyTotpToken = async (prevState: any, inputData: TotpModel) =>
  saveFormAction(inputData, totpZodModel, async (validatedData) => {
    const session = await getAuthUserSession();
    await userService.verifyTotpTokenAfterCreation(session.email, validatedData.totp);
  });

export const deactivate2fa = async () =>
  simpleAction(async () => {
    const session = await getAuthUserSession();
    console.log(session)
    await userService.deactivate2fa(session.email);
    return new SuccessActionResult(undefined, '2FA settings deactivated successfully');
  });

export const createRestApiKey = async (prevState: any, inputData: RestApiKeyCreateModel) =>
  saveFormAction(inputData, restApiKeyCreateZodModel, async (validatedData) => {
    const session = await getAuthUserSession();
    const user = await userService.getUserByEmail(session.email);
    const rawApiKey = await restApiKeyService.create(user.id, validatedData.name, validatedData.expiresAt ?? null);
    return new SuccessActionResult({ rawApiKey }, 'REST API key created successfully.');
  });

export const deleteRestApiKey = async (apiKeyId: string) =>
  simpleAction(async () => {
    const session = await getAuthUserSession();
    const user = await userService.getUserByEmail(session.email);
    await restApiKeyService.deleteByIdForUser(user.id, apiKeyId);
    return new SuccessActionResult(undefined, 'REST API key deleted successfully.');
  });
