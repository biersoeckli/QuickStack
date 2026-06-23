'use server'

import { SuccessActionResult } from "@/shared/model/server-action-error-return.model";
import { isAuthorizedWriteForAgent, isAuthorizedReadForAgent, getAuthUserSession, simpleAction } from "@/server/utils/action-wrapper.utils";
import { ensureDeleteAgentInProject, RequesterIdentity } from "@/server/utils/shared-authorization.utils";
import agentRuntimeService from "@/server/services/agent-runtime.service";
import agentService from "@/server/services/agent.service";
import podService from "@/server/services/pod.service";
import eventService from "@/server/services/event.service";

export const startAgent = async (agentId: string) =>
    simpleAction(async () => {
        await isAuthorizedWriteForAgent(agentId);
        await agentRuntimeService.startAgent(agentId);
    });

export const stopAgent = async (agentId: string) =>
    simpleAction(async () => {
        await isAuthorizedWriteForAgent(agentId);
        await agentRuntimeService.stopAgent(agentId);
    });

export const deployAgent = async (agentId: string) =>
    simpleAction(async () => {
        await isAuthorizedWriteForAgent(agentId);
        await agentService.deploy(agentId);
    });

export const deleteAgent = async (agentId: string) =>
    simpleAction(async () => {
        const session = await getAuthUserSession();
        const identity: RequesterIdentity = { type: 'session', session };
        const agent = await agentService.getById(agentId);
        ensureDeleteAgentInProject(identity, agent.projectId);
        await agentService.deleteById(agentId);
    });

export const getAgentStatus = async (agentId: string) =>
    simpleAction(async () => {
        await isAuthorizedReadForAgent(agentId);
        const status = await agentRuntimeService.getAgentStatus(agentId);
        const statusText = agentRuntimeService.statusTextFor(status);
        return { status, statusText };
    });

export const getPodsForAgent = async (agentId: string) =>
    simpleAction(async () => {
        await isAuthorizedReadForAgent(agentId);
        const agent = await agentService.getById(agentId);
        return podService.getPodsForAgent(agent.projectId, agentId);
    });

export const getAgentEvents = async (agentId: string) =>
    simpleAction(async () => {
        await isAuthorizedReadForAgent(agentId);
        const agent = await agentService.getById(agentId);
        return eventService.getEventsForAgent(agent.projectId, agentId);
    });

export const getAgentPodForTerminal = async (agentId: string) =>
    simpleAction(async () => {
        await isAuthorizedReadForAgent(agentId);
        const agent = await agentService.getById(agentId);
        const pods = await podService.getPodsForAgent(agent.projectId, agentId);
        if (pods.length === 0) {
            throw new Error('No agent pod running.');
        }
        return {
            podName: pods[0].podName,
            containerName: pods[0].containerName,
            namespace: agent.projectId,
        };
    });
