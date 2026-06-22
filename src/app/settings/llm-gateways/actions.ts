'use server'

import { SuccessActionResult } from "@/shared/model/server-action-error-return.model";
import { getAdminUserSession, saveFormAction, simpleAction } from "@/server/utils/action-wrapper.utils";
import { LlmGatewayEditModel, llmGatewayEditZodModel } from "@/shared/model/llm-gateway-edit.model";
import llmGatewayService from "@/server/services/llm-gateway.service";

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
