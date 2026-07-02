import { agentTemplateZodModel } from "@/shared/model/agent-template.model";
import { opencodeAgentTemplate } from "@/shared/templates/agents/opencode.template";
import { AgentTemplateUtils } from "./agent-template.utils";

describe("AgentTemplateUtils", () => {
    it("accepts the OpenCode agent template", () => {
        expect(agentTemplateZodModel.parse(opencodeAgentTemplate)).toEqual(opencodeAgentTemplate);
    });

    it("maps input settings to agent fields and env vars", () => {
        const template = {
            ...opencodeAgentTemplate.templates[0],
            inputSettings: [
                {
                    key: "containerImageSource",
                    label: "Container Image",
                    value: "custom/opencode:latest",
                    isEnvVar: false,
                    randomGeneratedIfEmpty: false,
                },
                {
                    key: "TOKEN",
                    label: "Token",
                    value: "secret",
                    isEnvVar: true,
                    randomGeneratedIfEmpty: false,
                },
            ],
        };

        const result = AgentTemplateUtils.mapTemplateInputValuesToAgent(template, template.inputSettings);

        expect(result.agent.containerImageSource).toBe("custom/opencode:latest");
        expect(result.envVars).toEqual([{ name: "TOKEN", value: "secret" }]);
    });
});
