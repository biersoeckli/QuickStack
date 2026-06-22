'use server'

import agentService from "@/server/services/agent.service";
import { saveFormAction } from "@/server/utils/action-wrapper.utils";
import {
    agentSourceZodModel,
    AgentSourceModel,
    agentRateLimitsZodModel,
    AgentRateLimitsModel,
    agentSystemPromptZodModel,
    AgentSystemPromptModel,
    agentEnvVarsZodModel,
    AgentEnvVarsModel,
} from "@/shared/model/agent-config.model";
import { getAuthUserSession } from "@/server/utils/action-wrapper.utils";
import { RequesterIdentity, ensureWriteProjectWorkload } from "@/server/utils/shared-authorization.utils";

const authorizeForAgent = async (agentId: string) => {
    const session = await getAuthUserSession();
    const identity: RequesterIdentity = { type: 'session', session };
    ensureWriteProjectWorkload(identity, agentId);
};

export const saveAgentSource = async (prevState: any, inputData: AgentSourceModel, agentId: string) =>
    saveFormAction(inputData, agentSourceZodModel, async (validatedData) => {
        await authorizeForAgent(agentId);
        await agentService.saveConfig(agentId, validatedData);
    });

export const saveAgentRateLimits = async (prevState: any, inputData: AgentRateLimitsModel, agentId: string) =>
    saveFormAction(inputData, agentRateLimitsZodModel, async (validatedData) => {
        await authorizeForAgent(agentId);
        await agentService.saveConfig(agentId, validatedData);
    });

export const saveAgentSystemPrompt = async (prevState: any, inputData: AgentSystemPromptModel, agentId: string) =>
    saveFormAction(inputData, agentSystemPromptZodModel, async (validatedData) => {
        await authorizeForAgent(agentId);
        await agentService.saveConfig(agentId, validatedData);
    });

export const saveAgentEnvVars = async (prevState: any, inputData: AgentEnvVarsModel, agentId: string) =>
    saveFormAction(inputData, agentEnvVarsZodModel, async (validatedData) => {
        await authorizeForAgent(agentId);
        await agentService.saveConfig(agentId, validatedData);
    });
