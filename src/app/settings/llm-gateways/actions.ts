'use server'

import { SuccessActionResult } from "@/shared/model/server-action-error-return.model";
import { getAdminUserSession, saveFormAction, simpleAction } from "@/server/utils/action-wrapper.utils";
import { LlmGatewayEditModel, llmGatewayEditZodModel } from "@/shared/model/llm-gateway-edit.model";
import llmGatewayService from "@/server/services/llm-gateway.service";

export const saveLlmGateway = async (prevState: any, inputData: LlmGatewayEditModel) =>
    saveFormAction(inputData, llmGatewayEditZodModel, async (validatedData) => {
        await getAdminUserSession();
        await llmGatewayService.save(validatedData);
        return new SuccessActionResult(undefined, 'LLM Gateway saved successfully.');
    });

export const testLlmGatewayConnection = async (inputData: LlmGatewayEditModel) =>
    simpleAction(async () => {
        await getAdminUserSession();
        const result = await llmGatewayService.testConnection(inputData);
        return new SuccessActionResult(result, `Connected. Loaded ${result.aliases.length} model aliases.`);
    });

export const deleteLlmGateway = async (llmGatewayId: string) =>
    simpleAction(async () => {
        await getAdminUserSession();
        await llmGatewayService.deleteById(llmGatewayId);
        return new SuccessActionResult(undefined, 'Successfully deleted LLM Gateway.');
    });
