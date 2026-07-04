import { AgentExtendedModel } from "@/shared/model/agent-extended.model";
import { LiteLlmModelMetadata } from "../adapter/litellm-api.adapter";

export interface AgentHarnessService {
    buildConfig(agent: AgentExtendedModel, modelMetadata?: Record<string, LiteLlmModelMetadata>): unknown;
}
