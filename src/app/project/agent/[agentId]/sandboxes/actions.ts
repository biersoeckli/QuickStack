'use server'

import { simpleAction, isAuthorizedWriteForWorkload, isAuthorizedReadForWorkload } from "@/server/utils/action-wrapper.utils";
import agentRuntimeService from "@/server/services/agent-runtime.service";
import agentAccessService, { AgentAccessView } from "@/server/services/agent-access.service";

export const startSandbox = async (agentId: string) =>
    simpleAction(async () => {
        const session = await isAuthorizedWriteForWorkload(agentId);
        return agentRuntimeService.startSandbox(agentId, session.userId);
    });

export const stopSandbox = async (agentId: string, sandboxName: string) =>
    simpleAction(async () => {
        await isAuthorizedWriteForWorkload(agentId);
        await agentRuntimeService.stopSandbox(agentId, sandboxName);
    });

export const getSandboxes = async (agentId: string) =>
    simpleAction(async () => {
        const session = await isAuthorizedWriteForWorkload(agentId);
        return agentRuntimeService.listSandboxes(agentId, session.userId);
    });

export const createAgentAccessUrl = async (
    agentId: string,
    sandboxName: string,
    view: AgentAccessView,
    domainId: string,
) => simpleAction(async () => {
    const session = await isAuthorizedReadForWorkload(agentId);
    return agentAccessService.createAccessUrl({
        agentId,
        sandboxName,
        view,
        domainId,
        session,
    });
});
