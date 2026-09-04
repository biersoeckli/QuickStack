import agentHarnessOpenCodeService from "@/server/services/agent-harness-opencode.service";
import { AgentExtendedModel } from "@/shared/model/agent-extended.model";
import { AgentTemplatePostCreateContext } from "@/shared/model/agent-template.model";
import { AgentFileMount } from "@prisma/client";
import { createCliAgentTemplate } from "./agent-harness-template.utils";

export const opencodeCliAgentTemplate = createCliAgentTemplate(
    'OpenCode CLI',
    'ghcr.io/anomalyco/opencode:1.18.27',
    'exec sleep infinity',
    {
        iconName: 'opencode.svg',
        description: 'A persistent terminal workspace for the OpenCode coding agent. It can plan, edit, and run code, using QuickStack LiteLLM or a directly configured model provider.',
        websiteUrl: 'https://opencode.ai/',
    },
);

export async function postCreateOpenCodeCliTemplate(
    createdAgents: AgentExtendedModel[],
    _context: AgentTemplatePostCreateContext,
): Promise<AgentExtendedModel[]> {
    const agent = createdAgents[0];
    if (!agent) return createdAgents;
    agent.agentFileMounts = [
        {
            containerMountPath: '/root/.config/opencode/opencode.json',
            content: JSON.stringify(agentHarnessOpenCodeService.buildConfig(agent), null, 2),
        } as AgentFileMount,
    ];
    return [agent];
}
