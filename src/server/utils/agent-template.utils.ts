import crypto from "crypto";
import { AgentTemplateContentModel } from "@/shared/model/agent-template.model";
import { AppTemplateInputSettingsModel } from "@/shared/model/app-template.model";
import { AgentEnvVarModel } from "@/shared/model/agent-config.model";

export class AgentTemplateUtils {
    static mapTemplateInputValuesToAgent(
        agentTemplate: AgentTemplateContentModel,
        inputValues: AppTemplateInputSettingsModel[],
    ) {
        this.populateRandomValues(inputValues);

        const { inputSettings, ...agent } = agentTemplate;
        const envVars: AgentEnvVarModel[] = [];

        for (const input of inputValues) {
            if (input.isEnvVar) {
                envVars.push({ name: input.key, value: input.value });
            } else {
                (agent as any)[input.key] = input.value;
            }
        }

        return { agent, envVars };
    }

    static populateRandomValues(inputValues: AppTemplateInputSettingsModel[]) {
        for (const input of inputValues) {
            if (input.randomGeneratedIfEmpty && !input.value) {
                input.value = crypto.randomBytes(16).toString("hex");
            }
        }
    }
}
