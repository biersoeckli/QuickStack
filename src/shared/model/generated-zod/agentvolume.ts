import * as z from "zod"

import { CompleteAgent, RelatedAgentModel } from "./index"

export const AgentVolumeModel = z.object({
  id: z.string(),
  containerMountPath: z.string(),
  size: z.number().int(),
  storageClassName: z.string(),
  agentId: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export interface CompleteAgentVolume extends z.infer<typeof AgentVolumeModel> {
  agent: CompleteAgent
}

/**
 * RelatedAgentVolumeModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const RelatedAgentVolumeModel: z.ZodSchema<CompleteAgentVolume> = z.lazy(() => AgentVolumeModel.extend({
  agent: RelatedAgentModel,
}))
