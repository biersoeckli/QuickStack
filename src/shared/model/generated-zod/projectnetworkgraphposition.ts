import * as z from "zod"

import { CompleteProject, RelatedProjectModel } from "./index"

export const ProjectNetworkGraphPositionModel = z.object({
  id: z.string(),
  projectId: z.string(),
  nodeId: z.string(),
  x: z.number(),
  y: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export interface CompleteProjectNetworkGraphPosition extends z.infer<typeof ProjectNetworkGraphPositionModel> {
  project: CompleteProject
}

/**
 * RelatedProjectNetworkGraphPositionModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const RelatedProjectNetworkGraphPositionModel: z.ZodSchema<CompleteProjectNetworkGraphPosition> = z.lazy(() => ProjectNetworkGraphPositionModel.extend({
  project: RelatedProjectModel,
}))
