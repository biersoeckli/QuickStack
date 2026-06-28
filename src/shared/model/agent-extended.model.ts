import { z } from "zod";
import { AgentDomainModel, AgentFileMountModel, AgentGitSshKeyModel, AgentModel, AgentVolumeModel, LlmGatewayModel, ProjectModel } from "./generated-zod";
import { Agent, Project } from "@prisma/client";

export const AgentExtendedZodModel = z.lazy(() => AgentModel.extend({
    project: ProjectModel,
    llmGateway: LlmGatewayModel,
    agentDomains: z.array(AgentDomainModel),
    agentVolumes: z.array(AgentVolumeModel),
    agentFileMounts: z.array(AgentFileMountModel),
    agentGitSshKey: AgentGitSshKeyModel.nullish(),
}));

export type AgentExtendedModel = z.infer<typeof AgentExtendedZodModel>;

export type AgentWithProjectModel = Agent & {
    project: Project;
};

export type AgentWithRelationsModel = z.infer<typeof AgentExtendedZodModel>;
