import * as z from "zod"

import { CompleteApp, RelatedAppModel } from "./index"

export const MonitoringSampleModel = z.object({
  id: z.string(),
  sampledAt: z.date(),
  measuredAt: z.date().nullish(),
  appId: z.string().nullish(),
  nodeName: z.string().nullish(),
  cpuCores: z.number().nullish(),
  ramBytes: z.number().nullish(),
  nodeFilesystemUsedBytes: z.number().nullish(),
})

export interface CompleteMonitoringSample extends z.infer<typeof MonitoringSampleModel> {
  app?: CompleteApp | null
}

/**
 * RelatedMonitoringSampleModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const RelatedMonitoringSampleModel: z.ZodSchema<CompleteMonitoringSample> = z.lazy(() => MonitoringSampleModel.extend({
  app: RelatedAppModel.nullish(),
}))
