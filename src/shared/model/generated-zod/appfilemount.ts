import * as z from "zod"

import { CompleteApp, RelatedAppModel } from "./index"

export const AppFileMountModel = z.object({
  id: z.string(),
  containerMountPath: z.string(),
  content: z.string(),
  appId: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export interface CompleteAppFileMount extends z.infer<typeof AppFileMountModel> {
  app: CompleteApp
}

/**
 * RelatedAppFileMountModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const RelatedAppFileMountModel: z.ZodSchema<CompleteAppFileMount> = z.lazy(() => AppFileMountModel.extend({
  app: RelatedAppModel,
}))
