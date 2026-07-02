import * as z from "zod"

import { CompleteAgent, RelatedAgentModel } from "./index"

export const AgentDomainModel = z.object({
  id: z.string(),
  hostname: z.string(),
  useSsl: z.boolean(),
  redirectHttps: z.boolean(),
  port: z.number().int(),
  agentId: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export interface CompleteAgentDomain extends z.infer<typeof AgentDomainModel> {
  agent: CompleteAgent
}

/**
 * RelatedAgentDomainModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const RelatedAgentDomainModel: z.ZodSchema<CompleteAgentDomain> = z.lazy(() => AgentDomainModel.extend({
  agent: RelatedAgentModel,
}))
