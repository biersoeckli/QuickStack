'use server'

import { SuccessActionResult } from "@/shared/model/server-action-error-return.model";
import { isAuthorizedWriteForAgent, isAuthorizedReadForAgent, getAuthUserSession, simpleAction, isAuthorizedReadForWorkload, isAuthorizedWriteForWorkload } from "@/server/utils/action-wrapper.utils";
import { ensureDeleteAgentInProject, RequesterIdentity } from "@/server/utils/shared-authorization.utils";
import agentRuntimeService from "@/server/services/agent-runtime.service";
import agentService from "@/server/services/agent.service";
import podService from "@/server/services/pod.service";
import eventService from "@/server/services/event.service";


export const deployAgent = async (agentId: string, forceBuild = false) =>
    simpleAction(async () => {
        await isAuthorizedWriteForWorkload(agentId);
        const deploymentId = await agentService.deploy(agentId, forceBuild);
        return new SuccessActionResult({ deploymentId }, 'Successfully started agent deployment.');
    });

export const deleteAgent = async (agentId: string) =>
    simpleAction(async () => {
        const session = await getAuthUserSession();
        const identity: RequesterIdentity = { type: 'session', session };
        const agent = await agentService.getById(agentId);
        ensureDeleteAgentInProject(identity, agent.projectId);
        await agentService.deleteById(agentId);
    });

export const getPodsForAgent = async (agentId: string) =>
    simpleAction(async () => {
        await isAuthorizedReadForWorkload(agentId);
        const agent = await agentService.getById(agentId);
        return podService.getPodsForAgent(agent.projectId, agentId);
    });

export const getAgentEvents = async (agentId: string) =>
    simpleAction(async () => {
        await isAuthorizedReadForWorkload(agentId);
        const agent = await agentService.getById(agentId);
        return eventService.getEventsForAgent(agent.projectId, agentId);
    });
