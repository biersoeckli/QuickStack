'use server'

import agentService from "@/server/services/agent.service";
import agentEnvironmentVariableService from "@/server/services/agent-environment-variable.service";
import { isAuthorizedReadForWorkload, isAuthorizedWriteForWorkload, saveFormAction, simpleAction } from "@/server/utils/action-wrapper.utils";
import {
    agentModelConfigurationZodModel,
    AgentModelConfigurationModel,
    agentSourceInfoContainerZodModel,
    agentSourceInfoGitSshZodModel,
    agentSourceInfoGitZodModel,
    agentGitBranchesLookupZodModel,
    agentDockerfileDetectionZodModel,
    AgentSourceInfoInputModel,
    AgentGitBranchesLookupModel,
    AgentDockerfileDetectionModel,
    agentRateLimitsZodModel,
    AgentRateLimitsModel,
    agentSystemPromptZodModel,
    AgentSystemPromptModel,
    agentEnvVarEditZodModel,
    AgentEnvVarEditModel,
    agentContainerConfigZodModel,
    AgentContainerConfigModel,
    isQuickStackReservedEnvName,
} from "@/shared/model/agent-config.model";
import { AgentVolumeEditModel, agentVolumeEditZodModel } from "@/shared/model/volume-edit.model";
import agentVolumeService from "@/server/services/agent-volume.service";
import agentNetworkPolicyService from "@/server/services/agent-network-policy.service";
import projectService from "@/server/services/project.service";
import {
    AgentNetworkPolicyEgressRuleEditModel,
    agentNetworkPolicyEgressRuleEditZodModel,
    AgentNetworkPolicySettingsModel,
    agentNetworkPolicySettingsZodModel,
} from "@/shared/model/agent-network-policy-edit.model";
import { FormValidationException } from "@/shared/model/form-validation-exception.model";
import { ServiceException } from "@/shared/model/service.exception.model";
import agentGitSshKeyService from "@/server/services/agent-git-ssh-key.service";
import gitService from "@/server/services/git.service";
import { ContainerCommangArgsUtils } from "@/shared/utils/container-command-args.utils";
import { z } from "zod";


export const saveAgentModelConfiguration = async (prevState: any, inputData: AgentModelConfigurationModel, agentId: string) =>
    saveFormAction(inputData, agentModelConfigurationZodModel, async (validatedData) => {
        await isAuthorizedWriteForWorkload(agentId);
        await agentService.saveAgent({
            ...validatedData,
            id: agentId
        });
    });

export const saveAgentSource = async (prevState: any, inputData: AgentSourceInfoInputModel, agentId: string) => {
    return simpleAction(async () => {
        await isAuthorizedWriteForWorkload(agentId);

        if (inputData.sourceType === 'GIT') {
            const validatedFields = agentSourceInfoGitZodModel.safeParse(inputData);
            if (!validatedFields.success) {
                throw new FormValidationException('Please correct the errors in the form.', validatedFields.error.flatten().fieldErrors);
            }
            const validatedData = validatedFields.data;
            await agentService.saveAgent({
                ...validatedData,
                buildMethod: 'DOCKERFILE',
                containerImageSource: null,
                containerRegistryUsername: null,
                containerRegistryPassword: null,
                sourceType: 'GIT',
                id: agentId,
            });
            return;
        }

        if (inputData.sourceType === 'GIT_SSH') {
            const validatedFields = agentSourceInfoGitSshZodModel.safeParse(inputData);
            if (!validatedFields.success) {
                throw new FormValidationException('Please correct the errors in the form.', validatedFields.error.flatten().fieldErrors);
            }
            const publicKey = await agentGitSshKeyService.getPublicKey(agentId);
            if (!publicKey) {
                throw new ServiceException('Generate SSH keys before saving a Git SSH source.');
            }
            const validatedData = validatedFields.data;
            await agentService.saveAgent({
                ...validatedData,
                buildMethod: 'DOCKERFILE',
                gitUsername: null,
                gitToken: null,
                containerImageSource: null,
                containerRegistryUsername: null,
                containerRegistryPassword: null,
                sourceType: 'GIT_SSH',
                id: agentId,
            });
            return;
        }

        if (inputData.sourceType === 'CONTAINER') {
            const validatedFields = agentSourceInfoContainerZodModel.safeParse(inputData);
            if (!validatedFields.success) {
                throw new FormValidationException('Please correct the errors in the form.', validatedFields.error.flatten().fieldErrors);
            }
            const validatedData = validatedFields.data;
            await agentService.saveAgent({
                ...validatedData,
                containerRegistryUsername: validatedData.containerRegistryUsername || null,
                containerRegistryPassword: validatedData.containerRegistryPassword || null,
                gitUrl: null,
                gitBranch: null,
                gitUsername: null,
                gitToken: null,
                sourceType: 'CONTAINER',
                buildMethod: 'DOCKERFILE',
                id: agentId,
            });
            return;
        }

        throw new ServiceException('Invalid Source Type');
    });
};

export const ensureAgentGitSshPublicKey = async (agentId: string) =>
    simpleAction(async () => {
        await isAuthorizedWriteForWorkload(agentId);
        return await agentGitSshKeyService.ensurePublicKey(agentId);
    });

export const generateOrRegenerateAgentGitSshKey = async (agentId: string) =>
    simpleAction(async () => {
        await isAuthorizedWriteForWorkload(agentId);
        return await agentGitSshKeyService.generateOrRegenerate(agentId);
    });

export const getAgentGitBranches = async (agentId: string, inputData: AgentGitBranchesLookupModel) =>
    simpleAction(async () => {
        const validatedFields = agentGitBranchesLookupZodModel.safeParse(inputData);
        if (!validatedFields.success) {
            throw new FormValidationException('Please make sure that you entered the correct Git credentials.', validatedFields.error.flatten().fieldErrors);
        }
        await isAuthorizedWriteForWorkload(agentId);
        return await gitService.listRemoteBranches({
            id: agentId,
            workloadType: 'agent',
            ...validatedFields.data,
        });
    });

export const detectAgentDockerfilePath = async (agentId: string, inputData: AgentDockerfileDetectionModel) =>
    simpleAction(async () => {
        const validatedFields = agentDockerfileDetectionZodModel.safeParse(inputData);
        if (!validatedFields.success) {
            throw new FormValidationException('Please make sure that you entered the correct Git source information.', validatedFields.error.flatten().fieldErrors);
        }

        await isAuthorizedWriteForWorkload(agentId);
        return await gitService.detectDockerfilePath({
            id: agentId,
            workloadType: 'agent',
            ...validatedFields.data,
        });
    });

export const saveAgentRateLimits = async (prevState: any, inputData: AgentRateLimitsModel, agentId: string) =>
    saveFormAction(inputData, agentRateLimitsZodModel, async (validatedData) => {
        await isAuthorizedWriteForWorkload(agentId);
        await agentService.saveAgent({
            id: agentId,
            ...validatedData
        });
    });

export const saveAgentContainerConfig = async (prevState: any, inputData: AgentContainerConfigModel, agentId: string) =>
    saveFormAction(inputData, agentContainerConfigZodModel, async (validatedData) => {
        await isAuthorizedWriteForWorkload(agentId);
        await agentService.saveAgent({
            ...validatedData,
            containerCommand: ContainerCommangArgsUtils.serializeContainerCommandItems(validatedData.containerCommand),
            containerArgs: ContainerCommangArgsUtils.serializeContainerCommandItems(validatedData.containerArgs),
            id: agentId,
        });
    });

export const saveAgentSystemPrompt = async (prevState: any, inputData: AgentSystemPromptModel, agentId: string) =>
    saveFormAction(inputData, agentSystemPromptZodModel, async (validatedData) => {
        await isAuthorizedWriteForWorkload(agentId);
        await agentService.saveAgent({
            ...validatedData,
            id: agentId,
        });
    });

export const saveAgentEnvVar = async (prevState: any, inputData: AgentEnvVarEditModel, agentId: string) =>
    saveFormAction(inputData, agentEnvVarEditZodModel, async (validatedData) => {
        await isAuthorizedWriteForWorkload(agentId);
        if (isQuickStackReservedEnvName(validatedData.name)) {
            throw new FormValidationException(`The environment variable name "${validatedData.name}" is reserved and cannot be used.`, {
                name: [`The environment variable name "${validatedData.name}" is reserved and cannot be used.`],
            });
        }
        await agentEnvironmentVariableService.saveEnvironmentVariable(agentId, validatedData);
    });

export const deleteAgentEnvVar = async (agentId: string, name: string) =>
    simpleAction(async () => {
        await isAuthorizedWriteForWorkload(agentId);
        await agentEnvironmentVariableService.deleteEnvironmentVariable(agentId, name);
    });

const actionAgentVolumeEditZodModel = agentVolumeEditZodModel.merge(z.object({
    id: z.string().nullish(),
}));

export const saveAgentVolume = async (prevState: any, inputData: AgentVolumeEditModel & { id?: string }, agentId: string) =>
    saveFormAction(inputData, actionAgentVolumeEditZodModel, async (validatedData) => {
        await isAuthorizedWriteForWorkload(agentId);
        await agentVolumeService.saveVolume({
            ...validatedData,
            agentId: agentId,
            id: validatedData.id ?? undefined,
        });
    });

export const deleteAgentVolume = async (volumeId: string) =>
    simpleAction(async () => {
        await isAuthorizedWriteForWorkload(volumeId);
        await agentVolumeService.deleteVolume(volumeId);
    });

export const saveAgentNetworkPolicySettings = async (prevState: any, inputData: AgentNetworkPolicySettingsModel, agentId: string) =>
    saveFormAction(inputData, agentNetworkPolicySettingsZodModel, async (validatedData) => {
        await isAuthorizedWriteForWorkload(agentId);
        await agentNetworkPolicyService.saveSettings({
            ...validatedData,
            agentId,
        });
    });

const actionAgentNetworkPolicyEgressRuleEditZodModel = agentNetworkPolicyEgressRuleEditZodModel.merge(z.object({
    id: z.string().nullish(),
}));

export const saveAgentNetworkPolicyEgressRule = async (prevState: any, inputData: AgentNetworkPolicyEgressRuleEditModel & { id?: string }, agentId: string) =>
    saveFormAction(inputData, actionAgentNetworkPolicyEgressRuleEditZodModel, async (validatedData) => {
        await isAuthorizedWriteForWorkload(agentId);
        await agentNetworkPolicyService.saveEgressRule({
            ...validatedData,
            agentId,
            id: validatedData.id ?? undefined,
        });
    });

export const deleteAgentNetworkPolicyEgressRule = async (ruleId: string) =>
    simpleAction(async () => {
        const rule = await agentNetworkPolicyService.getEgressRuleById(ruleId);
        await isAuthorizedWriteForWorkload(rule.agentNetworkPolicy.agentId);
        await agentNetworkPolicyService.deleteEgressRule(ruleId);
    });

export const getAppsForAgentNetworkPolicy = async (agentId: string) =>
    simpleAction(async () => {
        await isAuthorizedReadForWorkload(agentId);
        const projects = await projectService.getAll();
        return projects.map((project) => ({
            id: project.id,
            name: project.name,
            apps: project.apps.map((app) => ({ id: app.id, name: app.name })),
        }));
    });
