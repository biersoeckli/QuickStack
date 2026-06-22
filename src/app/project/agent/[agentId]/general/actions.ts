'use server'

import agentService from "@/server/services/agent.service";
import { isAuthorizedWriteForApp, saveFormAction } from "@/server/utils/action-wrapper.utils";
import { agentConfigZodModel, AgentConfigModel } from "@/shared/model/agent-config.model";
import { getAuthUserSession } from "@/server/utils/action-wrapper.utils";
import { RequesterIdentity, ensureWriteProjectWorkload } from "@/server/utils/shared-authorization.utils";

export const saveAgentConfig = async (prevState: any, inputData: AgentConfigModel, agentId: string) =>
    saveFormAction(inputData, agentConfigZodModel, async (validatedData) => {
        const session = await getAuthUserSession();
        const identity: RequesterIdentity = { type: 'session', session };
        ensureWriteProjectWorkload(identity, agentId);

        await agentService.saveConfig(agentId, validatedData);
    });
