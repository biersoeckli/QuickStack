import { AgentTemplateModel } from "@/shared/model/agent-template.model";
import { AgentExtendedModel } from "@/shared/model/agent-extended.model";
import { AgentTemplatePostCreateContext } from "@/shared/model/agent-template.model";
import { opencodeAgentTemplate, postCreateOpencodeAppTemplate } from "./agents/opencode.template";
import {
    claudeCodeAgentTemplate,
    copilotCliAgentTemplate,
    deepSeekHarnessCliAgentTemplate,
    geminiCliAgentTemplate,
    opencodeCliAgentTemplate,
    postCreateCliHarnessTemplate,
} from "./agents/cli-harnesses.template";

export const agentTemplates: AgentTemplateModel[] = [
    opencodeAgentTemplate,
    opencodeCliAgentTemplate,
    geminiCliAgentTemplate,
    copilotCliAgentTemplate,
    claudeCodeAgentTemplate,
    deepSeekHarnessCliAgentTemplate,
];

export const postCreateAgentTemplateFunctions: Map<
    string,
    (createdAgents: AgentExtendedModel[], context: AgentTemplatePostCreateContext) => Promise<AgentExtendedModel[]>
> = new Map([
    [opencodeAgentTemplate.name, postCreateOpencodeAppTemplate],
    [opencodeCliAgentTemplate.name, postCreateCliHarnessTemplate],
    [geminiCliAgentTemplate.name, postCreateCliHarnessTemplate],
    [copilotCliAgentTemplate.name, postCreateCliHarnessTemplate],
    [claudeCodeAgentTemplate.name, postCreateCliHarnessTemplate],
    [deepSeekHarnessCliAgentTemplate.name, postCreateCliHarnessTemplate],
]);
