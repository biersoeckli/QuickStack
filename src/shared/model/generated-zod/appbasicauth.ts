import * as z from "zod"

import { CompleteApp, RelatedAppModel } from "./index"

export const AppBasicAuthModel = z.object({
  id: z.string(),
  username: z.string(),
  password: z.string(),
  appId: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export interface CompleteAppBasicAuth extends z.infer<typeof AppBasicAuthModel> {
  app: CompleteApp
}

/**
 * RelatedAppBasicAuthModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const RelatedAppBasicAuthModel: z.ZodSchema<CompleteAppBasicAuth> = z.lazy(() => AppBasicAuthModel.extend({
  app: RelatedAppModel,
}))
