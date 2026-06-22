import * as z from "zod"

import { CompleteProject, RelatedProjectModel, CompleteLlmGateway, RelatedLlmGatewayModel } from "./index"

export const AgentModel = z.object({
  id: z.string(),
  name: z.string(),
  projectId: z.string(),
  llmGatewayId: z.string(),
  modelAlias: z.string(),
  image: z.string().nullish(),
  cpuRequest: z.string().nullish(),
  cpuLimit: z.string().nullish(),
  memoryRequest: z.string().nullish(),
  memoryLimit: z.string().nullish(),
  systemPrompt: z.string().nullish(),
  encryptedEnvVars: z.string().nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export interface CompleteAgent extends z.infer<typeof AgentModel> {
  project: CompleteProject
  llmGateway: CompleteLlmGateway
}

/**
 * RelatedAgentModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const RelatedAgentModel: z.ZodSchema<CompleteAgent> = z.lazy(() => AgentModel.extend({
  project: RelatedProjectModel,
  llmGateway: RelatedLlmGatewayModel,
}))
