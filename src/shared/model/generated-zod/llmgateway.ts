import * as z from "zod"

import { CompleteAgent, RelatedAgentModel } from "./index"

export const LlmGatewayModel = z.object({
  id: z.string(),
  name: z.string(),
  baseUrl: z.string(),
  encryptedAdminKey: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export interface CompleteLlmGateway extends z.infer<typeof LlmGatewayModel> {
  agents: CompleteAgent[]
}

/**
 * RelatedLlmGatewayModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const RelatedLlmGatewayModel: z.ZodSchema<CompleteLlmGateway> = z.lazy(() => LlmGatewayModel.extend({
  agents: RelatedAgentModel.array(),
}))
