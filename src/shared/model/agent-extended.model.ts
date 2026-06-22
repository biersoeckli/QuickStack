import { z } from "zod";
import { AgentModel, LlmGatewayModel, ProjectModel } from "./generated-zod";
import { Agent, LlmGateway, Project } from "@prisma/client";

export const AgentExtendedZodModel = z.lazy(() => AgentModel.extend({
    project: ProjectModel,
    llmGateway: LlmGatewayModel,
}));

export type AgentExtendedModel = z.infer<typeof AgentExtendedZodModel>;

export type AgentWithProjectModel = Agent & {
    project: Project;
};

export type AgentWithRelationsModel = Agent & {
    project: Project;
    llmGateway: LlmGateway;
};
