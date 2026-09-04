import { AgentTemplateModel } from "@/shared/model/agent-template.model";
import { AgentExtendedModel } from "@/shared/model/agent-extended.model";
import { AgentTemplatePostCreateContext } from "@/shared/model/agent-template.model";
import { opencodeAgentTemplate, postCreateOpencodeAppTemplate } from "./agents/opencode.template";
import {
    claudeCodeAgentTemplate,
    postCreateClaudeCodeTemplate,
} from "./agents/claude-code.template";
import {
    copilotCliAgentTemplate,
    postCreateCopilotCliTemplate,
} from "./agents/copilot-cli.template";
import {
    deepSeekHarnessCliAgentTemplate,
    postCreateDeepSeekHarnessCliTemplate,
} from "./agents/deepseek-harness-cli.template";
import {
    geminiCliAgentTemplate,
    postCreateGeminiCliTemplate,
} from "./agents/gemini-cli.template";
import {
    opencodeCliAgentTemplate,
    postCreateOpenCodeCliTemplate,
} from "./agents/opencode-cli.template";

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
    [opencodeCliAgentTemplate.name, postCreateOpenCodeCliTemplate],
    [geminiCliAgentTemplate.name, postCreateGeminiCliTemplate],
    [copilotCliAgentTemplate.name, postCreateCopilotCliTemplate],
    [claudeCodeAgentTemplate.name, postCreateClaudeCodeTemplate],
    [deepSeekHarnessCliAgentTemplate.name, postCreateDeepSeekHarnessCliTemplate],
]);
