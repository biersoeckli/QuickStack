import * as z from "zod"

import { CompleteAgent, RelatedAgentModel } from "./index"

export const AgentFileMountModel = z.object({
  id: z.string(),
  containerMountPath: z.string(),
  content: z.string(),
  agentId: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export interface CompleteAgentFileMount extends z.infer<typeof AgentFileMountModel> {
  agent: CompleteAgent
}

/**
 * RelatedAgentFileMountModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const RelatedAgentFileMountModel: z.ZodSchema<CompleteAgentFileMount> = z.lazy(() => AgentFileMountModel.extend({
  agent: RelatedAgentModel,
}))
