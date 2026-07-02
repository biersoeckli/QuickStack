'use server'

import { simpleAction, isAuthorizedWriteForWorkload, isAuthorizedReadForWorkload } from "@/server/utils/action-wrapper.utils";
import agentRuntimeService from "@/server/services/agent-runtime.service";
import agentAccessService, { AgentAccessView } from "@/server/services/agent-access.service";

export const startInstance = async (agentId: string) =>
    simpleAction(async () => {
        const session = await isAuthorizedWriteForWorkload(agentId);
        return agentRuntimeService.startInstance(agentId, session.userId);
    });

export const stopInstance = async (agentId: string, claimName: string) =>
    simpleAction(async () => {
        const session = await isAuthorizedWriteForWorkload(agentId);
        await agentRuntimeService.stopInstance(agentId, claimName);
    });

export const getInstances = async (agentId: string) =>
    simpleAction(async () => {
        const session = await isAuthorizedWriteForWorkload(agentId);
        return agentRuntimeService.listInstances(agentId, session.userId);
    });

export const createAgentAccessUrl = async (
    agentId: string,
    claimName: string,
    view: AgentAccessView,
    domainId: string,
) => simpleAction(async () => {
    const session = await isAuthorizedReadForWorkload(agentId);
    return agentAccessService.createAccessUrl({
        agentId,
        claimName,
        view,
        domainId,
        session,
    });
});
