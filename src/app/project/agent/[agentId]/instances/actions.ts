'use server'

import { isAuthorizedWriteForAgent, isAuthorizedReadForAgent, simpleAction } from "@/server/utils/action-wrapper.utils";
import agentRuntimeService from "@/server/services/agent-runtime.service";

export const startInstance = async (agentId: string) =>
    simpleAction(async () => {
        await isAuthorizedWriteForAgent(agentId);
        return agentRuntimeService.startInstance(agentId);
    });

export const stopInstance = async (agentId: string, claimName: string) =>
    simpleAction(async () => {
        await isAuthorizedWriteForAgent(agentId);
        await agentRuntimeService.stopInstance(agentId, claimName);
    });

export const getInstances = async (agentId: string) =>
    simpleAction(async () => {
        await isAuthorizedReadForAgent(agentId);
        return agentRuntimeService.listInstances(agentId);
    });
