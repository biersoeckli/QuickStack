'use server'

import { SuccessActionResult } from "@/shared/model/server-action-error-return.model";
import { isAuthorizedWriteForAgent, isAuthorizedReadForAgent, simpleAction } from "@/server/utils/action-wrapper.utils";
import agentRuntimeService from "@/server/services/agent-runtime.service";

export const startAgent = async (agentId: string) =>
    simpleAction(async () => {
        await isAuthorizedWriteForAgent(agentId);
        await agentRuntimeService.startAgent(agentId);
        return new SuccessActionResult(undefined, 'Agent started successfully.');
    });

export const stopAgent = async (agentId: string) =>
    simpleAction(async () => {
        await isAuthorizedWriteForAgent(agentId);
        await agentRuntimeService.stopAgent(agentId);
        return new SuccessActionResult(undefined, 'Agent stopped successfully.');
    });

export const getAgentStatus = async (agentId: string) =>
    simpleAction(async () => {
        await isAuthorizedReadForAgent(agentId);
        const status = await agentRuntimeService.getAgentStatus(agentId);
        const statusText = agentRuntimeService.statusTextFor(status);
        return { status, statusText } as any;
    });
