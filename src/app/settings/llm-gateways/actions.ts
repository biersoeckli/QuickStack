'use server'

import { getAdminUserSession, saveFormAction, simpleAction } from "@/server/utils/action-wrapper.utils";
import { LlmGatewayEditModel, llmGatewayEditZodModel } from "@/shared/model/llm-gateway-edit.model";
import llmGatewayService from "@/server/services/llm-gateway.service";
import { z } from "zod";
import projectService from "@/server/services/project.service";
import appTemplateService from "@/server/services/app-template.service";
import { litellmAppTemplate } from "@/shared/templates/apps/litellm.template";
import { ServiceException } from "@/shared/model/service.exception.model";


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

        return await appTemplateService.createAppFromTemplate(targetProjectId, structuredClone(litellmAppTemplate));
    });
