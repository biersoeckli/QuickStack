import { AgentTemplateModel } from "@/shared/model/agent-template.model";
import { AgentExtendedModel } from "@/shared/model/agent-extended.model";
import { AgentTemplatePostCreateContext } from "@/shared/model/agent-template.model";
import { opencodeAgentTemplate } from "./agents/opencode.template";

export const agentTemplates: AgentTemplateModel[] = [
    opencodeAgentTemplate,
];

export const postCreateAgentTemplateFunctions: Map<
    string,
    (createdAgents: AgentExtendedModel[], context: AgentTemplatePostCreateContext) => Promise<AgentExtendedModel[]>
> = new Map([]);
