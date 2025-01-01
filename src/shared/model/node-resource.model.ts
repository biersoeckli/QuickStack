import { stringToNumber, stringToOptionalNumber } from "@/shared/utils/zod.utils";
import { pid } from "process";
import { z } from "zod";

export const nodeResourceZodModel = z.object({
  name: z.string(),
  cpuUsage: z.number(),
  cpuCapacity: z.number(),
  ramUsage: z.number(),
  ramCapacity: z.number(),
  diskUsageAbsolut: z.number(),
  diskUsageCapacity: z.number(),
  diskUsageReserved: z.number(),
  diskSpaceSchedulable: z.number(),
})

export type NodeResourceModel = z.infer<typeof nodeResourceZodModel>;