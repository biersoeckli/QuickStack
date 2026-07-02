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

export type AgentWithProjectModel = Agent & {
    project: Project;
};

export type AgentExtendedModel = z.infer<typeof AgentExtendedZodModel>;

// --- Write model (upsert) ---

const agentSubItemWriteMeta = z.object({
    id: z.string().optional(),
    agentId: z.string().optional(),
    createdAt: z.date().optional(),
    updatedAt: z.date().optional(),
});

const agentWriteOmitFields = {
    createdAt: true,
    updatedAt: true,
} as const;

/** Write schema for upsert: id optional (absent = create), server meta fields stripped. */
export const AgentExtendedWriteZodModel = AgentModel
    .omit(agentWriteOmitFields)
    .extend({
        id: z.string().optional(),
        agentDomains: AgentDomainModel.merge(agentSubItemWriteMeta).omit(agentWriteOmitFields).array(),
        agentVolumes: AgentVolumeModel.merge(agentSubItemWriteMeta).omit(agentWriteOmitFields).array(),
        agentFileMounts: AgentFileMountModel.merge(agentSubItemWriteMeta).omit(agentWriteOmitFields).array(),
    });

export type AgentExtendedWriteModel = z.infer<typeof AgentExtendedWriteZodModel>;
