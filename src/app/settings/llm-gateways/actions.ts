'use server'

import { getAdminUserSession, isAuthorizedReadForWorkload, saveFormAction, simpleAction } from "@/server/utils/action-wrapper.utils";
import { LlmGatewayEditModel, llmGatewayEditZodModel } from "@/shared/model/llm-gateway-edit.model";
import llmGatewayService from "@/server/services/llm-gateway.service";
import { z } from "zod";
import projectService from "@/server/services/project.service";
import appTemplateService from "@/server/services/app-template.service";
import { litellmAppTemplate } from "@/shared/templates/apps/litellm.template";
import { ServiceException } from "@/shared/model/service.exception.model";
import appService from "@/server/services/app.service";
import { EnvVarUtils } from "@/server/utils/env-var.utils";
import { InternalHostnameUtils } from "@/server/utils/internal-hostname.utils";
import { Constants } from "@/shared/utils/constants";


export const saveLlmGateway = async (prevState: any, inputData: LlmGatewayEditModel) =>
    saveFormAction(inputData, llmGatewayEditZodModel, async (validatedData) => {
        await getAdminUserSession();
        if (!validatedData.id && !validatedData.adminKey?.trim()) {
            return { success: false, fieldErrors: { adminKey: 'LiteLLM Admin Key is required.' } };
        }
        await llmGatewayService.save(validatedData);
    });

export const testLlmGatewayConnection = async (inputData: LlmGatewayEditModel) =>
    simpleAction(async () => {
        await getAdminUserSession();
        if (!inputData.id && !inputData.adminKey?.trim()) {
            return { success: false, fieldErrors: { adminKey: 'LiteLLM Admin Key is required.' } };
        }
        await llmGatewayService.testConnection(inputData);
    });

export const deleteLlmGateway = async (llmGatewayId: string) =>
    simpleAction(async () => {
        await getAdminUserSession();
        await llmGatewayService.deleteById(llmGatewayId);
    });

const deployLiteLlmGatewayInstanceZodModel = z.object({
    projectId: z.string().optional(),
    newProjectName: z.string().optional(),
});

export const deployLiteLlmGatewayInstance = async (inputData: z.infer<typeof deployLiteLlmGatewayInstanceZodModel>) =>
    simpleAction(async () => {
        await getAdminUserSession();

        const validatedInput = deployLiteLlmGatewayInstanceZodModel.safeParse(inputData);
        if (!validatedInput.success) {
            throw new ServiceException('Please select a Project or create a new one.');
        }

        const { projectId, newProjectName } = validatedInput.data;
        let targetProjectId = projectId;

        if (newProjectName?.trim()) {
            const project = await projectService.save({
                name: newProjectName.trim(),
                projectType: 'APP',
            });
            targetProjectId = project.id;
        }

        if (!targetProjectId) {
            throw new ServiceException('Please select a Project or create a new one.');
        }

        const targetProject = await projectService.getById(targetProjectId);
        if (targetProject.projectType !== 'APP') {
            throw new ServiceException('LiteLLM can only be deployed into an App Project.');
        }

        const createdAppIds = await appTemplateService.createAppFromTemplate(targetProjectId, structuredClone(litellmAppTemplate));
        const liteLlmGatewayAppId = createdAppIds[2];
        // deactivate network policy -> todo: updatein future when new network policy is implemented for apps
        await appService.save({
            id: liteLlmGatewayAppId,
            useNetworkPolicy: false,
        });
        return createdAppIds;
    });

export const getLiteLlmInfosFromAppId = async (appId: string) =>
    simpleAction(async () => {
        await isAuthorizedReadForWorkload(appId);
        const app = await appService.getExtendedById(appId);
        // try to fetch the admin key
        const vars = EnvVarUtils.parseEnvVariables(app);
        const adminKey = vars.find(v => v.name === 'LITELLM_MASTER_KEY')?.value;
        if (!adminKey) {
            throw new ServiceException('LiteLLM Admin Key not found. Maybe this app is not a LiteLLM instance or the key has been removed.');
        }

        return {
            adminKey,
            baseUrl: InternalHostnameUtils.getInternalBaseUrlForApp(app, Constants.DEFAULT_LITELLM_PORT)
        };
    });
