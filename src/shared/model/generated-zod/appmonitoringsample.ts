import * as z from "zod"

import { CompleteApp, RelatedAppModel } from "./index"

export const AppMonitoringSampleModel = z.object({
  id: z.string(),
  sampledAt: z.date(),
  appId: z.string(),
  cpuCores: z.number().nullish(),
  ramBytes: z.number().nullish(),
  measuredAt: z.date().nullish(),
})

export interface CompleteAppMonitoringSample extends z.infer<typeof AppMonitoringSampleModel> {
  app: CompleteApp
}

/**
 * RelatedAppMonitoringSampleModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const RelatedAppMonitoringSampleModel: z.ZodSchema<CompleteAppMonitoringSample> = z.lazy(() => AppMonitoringSampleModel.extend({
  app: RelatedAppModel,
}))
