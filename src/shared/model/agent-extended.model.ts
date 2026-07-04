import { z } from "zod";
import { AgentDomainModel, AgentFileMountModel, AgentGitSshKeyModel, AgentModel, AgentNetworkPolicyModel, AgentNetworkPolicyRuleModel, AgentVolumeModel, LlmGatewayModel, ProjectModel } from "./generated-zod";
import { Agent, Project } from "@prisma/client";

export const AgentNetworkPolicyRuleWithTargetAppZodModel = AgentNetworkPolicyRuleModel.extend({
    targetApp: z.object({
        id: z.string(),
        name: z.string(),
        projectId: z.string()
    }),
});
export type AgentNetworkPolicyRuleWithTargetAppModel = z.infer<typeof AgentNetworkPolicyRuleWithTargetAppZodModel>;

const AgentNetworkPolicyWithRulesZodModel = AgentNetworkPolicyModel.extend({
    rules: z.array(AgentNetworkPolicyRuleWithTargetAppZodModel),
});

export const AgentExtendedZodModel = z.lazy(() => AgentModel.extend({
    modelAlias: z.array(z.string()),
    project: ProjectModel,
    llmGateway: LlmGatewayModel,
    agentDomains: z.array(AgentDomainModel),
    agentVolumes: z.array(AgentVolumeModel),
    agentFileMounts: z.array(AgentFileMountModel),
    agentGitSshKey: AgentGitSshKeyModel.nullish(),
    agentNetworkPolicy: AgentNetworkPolicyWithRulesZodModel.nullish(),
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

const agentNetworkPolicyRuleWriteMeta = z.object({
    id: z.string().optional(),
    agentNetworkPolicyId: z.string().optional(),
    type: z.string().optional().default('EGRESS'),
    port: z.number().int().optional().default(443),
    protocol: z.string().optional().default('TCP'),
    createdAt: z.date().optional(),
    updatedAt: z.date().optional(),
});

/** Write schema for a rule: only `targetAppId` is required, all other fields have defaults. */
const AgentNetworkPolicyRuleWriteZodModel = AgentNetworkPolicyRuleModel
    .merge(agentNetworkPolicyRuleWriteMeta)
    .omit(agentWriteOmitFields);

const agentNetworkPolicyWriteMeta = z.object({
    id: z.string().optional(),
    agentId: z.string().optional(),
    allowInternetAccess: z.boolean().optional().default(true),
    createdAt: z.date().optional(),
    updatedAt: z.date().optional(),
});

const AgentNetworkPolicyWriteZodModel = AgentNetworkPolicyModel
    .merge(agentNetworkPolicyWriteMeta)
    .omit(agentWriteOmitFields)
    .extend({
        rules: AgentNetworkPolicyRuleWriteZodModel.array(),
    });

/** Write schema for upsert: id optional (absent = create), server meta fields stripped. */
export const AgentExtendedWriteZodModel = AgentModel
    .omit(agentWriteOmitFields)
    .extend({
        id: z.string().optional(),
        modelAlias: z.array(z.string().trim().min(1)).min(1),
        agentDomains: AgentDomainModel.merge(agentSubItemWriteMeta).omit(agentWriteOmitFields).array(),
        agentVolumes: AgentVolumeModel.merge(agentSubItemWriteMeta).omit(agentWriteOmitFields).array(),
        agentFileMounts: AgentFileMountModel.merge(agentSubItemWriteMeta).omit(agentWriteOmitFields).array(),
        agentNetworkPolicy: AgentNetworkPolicyWriteZodModel.optional(),
    });

export type AgentExtendedWriteModel = z.infer<typeof AgentExtendedWriteZodModel>;
