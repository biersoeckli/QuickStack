import * as z from "zod"


export const NodeMonitoringSampleModel = z.object({
  id: z.string(),
  sampledAt: z.date(),
  nodeName: z.string(),
  cpuCores: z.number().nullish(),
  ramBytes: z.number().nullish(),
  diskBytes: z.number().nullish(),
})
