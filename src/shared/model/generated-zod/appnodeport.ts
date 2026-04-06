import * as z from "zod"

import { CompleteApp, RelatedAppModel } from "./index"

export const AppNodePortModel = z.object({
  id: z.string(),
  appId: z.string(),
  port: z.number().int(),
  nodePort: z.number().int(),
  protocol: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export interface CompleteAppNodePort extends z.infer<typeof AppNodePortModel> {
  app: CompleteApp
}

/**
 * RelatedAppNodePortModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const RelatedAppNodePortModel: z.ZodSchema<CompleteAppNodePort> = z.lazy(() => AppNodePortModel.extend({
  app: RelatedAppModel,
}))
