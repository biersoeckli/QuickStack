import * as z from "zod"

import { CompleteProject, RelatedProjectModel, CompleteLlmGateway, RelatedLlmGatewayModel, CompleteRoleAgentPermission, RelatedRoleAgentPermissionModel, CompleteAgentDomain, RelatedAgentDomainModel, CompleteAgentVolume, RelatedAgentVolumeModel, CompleteAgentFileMount, RelatedAgentFileMountModel } from "./index"

export const AgentModel = z.object({
  id: z.string(),
  name: z.string(),
  projectId: z.string(),
  llmGatewayId: z.string(),
  modelAlias: z.string(),
  image: z.string().nullish(),
  cpuRequest: z.number().int().nullish(),
  cpuLimit: z.number().int().nullish(),
  memoryRequest: z.number().int().nullish(),
  memoryLimit: z.number().int().nullish(),
  systemPrompt: z.string().nullish(),
  encryptedEnvVars: z.string().nullish(),
  containerCommand: z.string().nullish(),
  containerArgs: z.string().nullish(),
  warmPoolReplicas: z.number().int(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export interface CompleteAgent extends z.infer<typeof AgentModel> {
  project: CompleteProject
  llmGateway: CompleteLlmGateway
  roleAgentPermissions: CompleteRoleAgentPermission[]
  agentDomains: CompleteAgentDomain[]
  agentVolumes: CompleteAgentVolume[]
  agentFileMounts: CompleteAgentFileMount[]
}

/**
 * RelatedAgentModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const RelatedAgentModel: z.ZodSchema<CompleteAgent> = z.lazy(() => AgentModel.extend({
  project: RelatedProjectModel,
  llmGateway: RelatedLlmGatewayModel,
  roleAgentPermissions: RelatedRoleAgentPermissionModel.array(),
  agentDomains: RelatedAgentDomainModel.array(),
  agentVolumes: RelatedAgentVolumeModel.array(),
  agentFileMounts: RelatedAgentFileMountModel.array(),
}))
