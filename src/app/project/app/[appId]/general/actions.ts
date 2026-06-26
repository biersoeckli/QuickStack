'use server'

import { AppRateLimitsModel, appRateLimitsZodModel } from "@/shared/model/app-rate-limits.model";
import { appDockerfileDetectionZodModel, appGitBranchesLookupZodModel, appSourceInfoContainerZodModel, appSourceInfoGitSshZodModel, appSourceInfoGitZodModel, AppDockerfileDetectionModel, AppGitBranchesLookupModel, AppSourceInfoInputModel } from "@/shared/model/app-source-info.model";
import { SuccessActionResult } from "@/shared/model/server-action-error-return.model";
import { FormValidationException } from "@/shared/model/form-validation-exception.model";
import { ServiceException } from "@/shared/model/service.exception.model";
import appService from "@/server/services/app.service";
import { isAuthorizedWriteForApp, saveFormAction, simpleAction } from "@/server/utils/action-wrapper.utils";
import { appContainerConfigZodModel } from "@/shared/model/app-container-config.model";
import { AppContainerConfigInputModel } from "./app-container-config";
import { serializeContainerCommandItems } from "@/shared/utils/container-command-args.utils";
import appGitSshKeyService from "@/server/services/app-git-ssh-key.service";
import gitService from "@/server/services/git.service";

export const saveGeneralAppSourceInfo = async (prevState: any, inputData: AppSourceInfoInputModel, appId: string) => {
    return simpleAction(async () => {
        await isAuthorizedWriteForApp(appId);
        const existingApp = await appService.getById(appId);
        if (existingApp.appType !== 'APP' && inputData.sourceType !== 'CONTAINER') {
            throw new ServiceException('Only application workloads can use Git sources.');
        }

        if (inputData.sourceType === 'GIT') {
            const validatedFields = appSourceInfoGitZodModel.safeParse(inputData);
            if (!validatedFields.success) {
                throw new FormValidationException('Please correct the errors in the form.', validatedFields.error.flatten().fieldErrors);
            }
            const validatedData = validatedFields.data;
            if (validatedData.buildMethod === 'DOCKERFILE' && !validatedData.dockerfilePath) {
                throw new FormValidationException('Please correct the errors in the form.', {
                    dockerfilePath: ['Path to Dockerfile is required when using the Dockerfile build method.'],
                });
            }
            await appService.save({
                ...existingApp,
                ...validatedData,
                gitUsername: validatedData.gitUsername || null,
                gitToken: validatedData.gitToken || null,
                dockerfilePath: validatedData.buildMethod === 'DOCKERFILE'
                    ? validatedData.dockerfilePath ?? existingApp.dockerfilePath
                    : existingApp.dockerfilePath,
                containerImageSource: null,
                containerRegistryUsername: null,
                containerRegistryPassword: null,
                sourceType: 'GIT',
                id: appId,
            });
            return;
        }

        if (inputData.sourceType === 'GIT_SSH') {
            const validatedFields = appSourceInfoGitSshZodModel.safeParse(inputData);
            if (!validatedFields.success) {
                throw new FormValidationException('Please correct the errors in the form.', validatedFields.error.flatten().fieldErrors);
            }
            const validatedData = validatedFields.data;
            if (validatedData.buildMethod === 'DOCKERFILE' && !validatedData.dockerfilePath) {
                throw new FormValidationException('Please correct the errors in the form.', {
                    dockerfilePath: ['Path to Dockerfile is required when using the Dockerfile build method.'],
                });
            }
            const publicKey = await appGitSshKeyService.getPublicKey(appId);
            if (!publicKey) {
                throw new ServiceException('Generate SSH keys before saving a Git SSH source.');
            }
            await appService.save({
                ...existingApp,
                ...validatedData,
                gitUsername: null,
                gitToken: null,
                dockerfilePath: validatedData.buildMethod === 'DOCKERFILE'
                    ? validatedData.dockerfilePath ?? existingApp.dockerfilePath
                    : existingApp.dockerfilePath,
                containerImageSource: null,
                containerRegistryUsername: null,
                containerRegistryPassword: null,
                sourceType: 'GIT_SSH',
                id: appId,
            });
            return;
        }

        if (inputData.sourceType === 'CONTAINER') {
            const validatedFields = appSourceInfoContainerZodModel.safeParse(inputData);
            if (!validatedFields.success) {
                throw new FormValidationException('Please correct the errors in the form.', validatedFields.error.flatten().fieldErrors);
            }
            const validatedData = validatedFields.data;
            await appService.save({
                ...existingApp,
                ...validatedData,
                containerRegistryUsername: validatedData.containerRegistryUsername || null,
                containerRegistryPassword: validatedData.containerRegistryPassword || null,
                gitUrl: null,
                gitBranch: null,
                gitUsername: null,
                gitToken: null,
                sourceType: 'CONTAINER',
                id: appId,
            });
            return;
        }

        throw new ServiceException('Invalid Source Type');
    });
};

export const ensureGitSshPublicKey = async (appId: string) =>
    simpleAction(async () => {
        await isAuthorizedWriteForApp(appId);
        return await appGitSshKeyService.ensurePublicKey(appId);
    });

export const generateOrRegenerateGitSshKey = async (appId: string) =>
    simpleAction(async () => {
        await isAuthorizedWriteForApp(appId);
        return await appGitSshKeyService.generateOrRegenerate(appId);
    });

export const getGitBranches = async (appId: string, inputData: AppGitBranchesLookupModel) =>
    simpleAction(async () => {
        const validatedFields = appGitBranchesLookupZodModel.safeParse(inputData);
        if (!validatedFields.success) {
            throw new FormValidationException('Please make sure that you entered the correct Git credentials.', validatedFields.error.flatten().fieldErrors);
        }

        await isAuthorizedWriteForApp(appId);
        return await gitService.listRemoteBranches({
            id: appId,
            ...validatedFields.data,
        });
    });

export const detectDockerfilePath = async (appId: string, inputData: AppDockerfileDetectionModel) =>
    simpleAction(async () => {
        const validatedFields = appDockerfileDetectionZodModel.safeParse(inputData);
        if (!validatedFields.success) {
            throw new FormValidationException('Please make sure that you entered the correct Git source information.', validatedFields.error.flatten().fieldErrors);
        }

        await isAuthorizedWriteForApp(appId);
        return await gitService.detectDockerfilePath({
            id: appId,
            ...validatedFields.data,
        });
    });

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

export const saveGeneralAppContainerConfig = async (prevState: any, inputData: AppContainerConfigInputModel, appId: string) =>
    saveFormAction(inputData, appContainerConfigZodModel, async (validatedData) => {
        await isAuthorizedWriteForApp(appId);
        const existingApp = await appService.getById(appId);

        const containerCommandJson = serializeContainerCommandItems(validatedData.containerCommand);
        const containerArgsJson = validatedData.containerArgs && validatedData.containerArgs.length > 0
            ? JSON.stringify(validatedData.containerArgs.map(arg => arg.value))
            : null;

        await appService.save({
            ...existingApp,
            containerCommand: containerCommandJson,
            containerArgs: containerArgsJson,
            securityContextRunAsUser: validatedData.securityContextRunAsUser ?? null,
            securityContextRunAsGroup: validatedData.securityContextRunAsGroup ?? null,
            securityContextFsGroup: validatedData.securityContextFsGroup ?? null,
            securityContextPrivileged: validatedData.securityContextPrivileged ?? false,
            id: appId,
        });
    });
