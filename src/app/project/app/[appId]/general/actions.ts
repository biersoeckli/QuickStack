'use server'

import { AppRateLimitsModel, appRateLimitsZodModel } from "@/shared/model/app-rate-limits.model";
import { appSourceInfoContainerZodModel, appSourceInfoGitZodModel, AppSourceInfoInputModel, appSourceInfoInputZodModel } from "@/shared/model/app-source-info.model";
import { AuthFormInputSchema, authFormInputSchemaZod } from "@/shared/model/auth-form";
import { ErrorActionResult, ServerActionResult, SuccessActionResult } from "@/shared/model/server-action-error-return.model";
import { ServiceException } from "@/shared/model/service.exception.model";
import appService from "@/server/services/app.service";
import userService from "@/server/services/user.service";
import sshService from "@/server/services/ssh.service";
import { getAuthUserSession, isAuthorizedWriteForApp, saveFormAction, simpleAction } from "@/server/utils/action-wrapper.utils";


export const saveGeneralAppSourceInfo = async (prevState: any, inputData: AppSourceInfoInputModel, appId: string) => {
    if (inputData.sourceType === 'GIT') {
        return saveFormAction(inputData, appSourceInfoGitZodModel, async (validatedData) => {
            await isAuthorizedWriteForApp(appId);
            const existingApp = await appService.getById(appId);

            let updateData = {
                ...existingApp,
                ...validatedData,
                sourceType: 'GIT',
                id: appId,
            };

            // If switching to SSH authentication and no SSH keys exist, generate them
            if (validatedData.gitAuthType === 'SSH' && !existingApp.gitSshPrivateKey) {
                const keyPair = await sshService.generateSshKeyPair(appId);
                updateData = {
                    ...updateData,
                    gitSshPrivateKey: keyPair.privateKey,
                    gitSshPublicKey: keyPair.publicKey,
                };
            }

            await appService.save(updateData);
        });
    } else if (inputData.sourceType === 'CONTAINER') {
        return saveFormAction(inputData, appSourceInfoContainerZodModel, async (validatedData) => {
            await isAuthorizedWriteForApp(appId);
            const existingApp = await appService.getById(appId);
            await appService.save({
                ...existingApp,
                ...validatedData,
                sourceType: 'CONTAINER',
                id: appId,
            });
        });
    } else {
        return simpleAction(async () => new ServerActionResult('error', undefined, 'Invalid Source Type', undefined));
    }
};

export const regenerateSshKey = async (appId: string) => {
    return simpleAction(async () => {
        await isAuthorizedWriteForApp(appId);
        const existingApp = await appService.getById(appId);

        if (existingApp.sourceType !== 'GIT' || existingApp.gitAuthType !== 'SSH') {
            throw new ServiceException('SSH key can only be regenerated for Git apps using SSH authentication');
        }

        const keyPair = await sshService.generateSshKeyPair(appId);
        await appService.save({
            ...existingApp,
            gitSshPrivateKey: keyPair.privateKey,
            gitSshPublicKey: keyPair.publicKey,
        });

        return new SuccessActionResult(keyPair.publicKey, 'SSH key regenerated successfully');
    });
};

export const saveGeneralAppRateLimits = async (prevState: any, inputData: AppRateLimitsModel, appId: string) =>
    saveFormAction(inputData, appRateLimitsZodModel, async (validatedData) => {
        if (validatedData.replicas < 1) {
            throw new ServiceException('Replica Count must be at least 1');
        }
        await isAuthorizedWriteForApp(appId);

        const extendedApp = await appService.getExtendedById(appId);
        if (extendedApp.appVolumes.some(v => v.accessMode === 'ReadWriteOnce') && validatedData.replicas > 1) {
            throw new ServiceException('Replica Count must be 1 because you have at least one volume with access mode ReadWriteOnce.');
        }

        const existingApp = await appService.getById(appId);
        await appService.save({
            ...existingApp,
            ...validatedData,
            id: appId,
        });
    });
