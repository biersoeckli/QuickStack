import { stringToNumber, stringToOptionalNumber } from "@/shared/utils/zod.utils";
import { pid } from "process";
import { z } from "zod";

export const nodeResourceZodModel = z.object({
  name: z.string(),
  cpuUsageAbsolut: z.number(),
  cpuUsageCapacity: z.number(),
  ramUsageAbsolut: z.number(),
  ramUsageCapacity: z.number(),
  diskUsageAbsolut: z.number(),
  diskUsageCapacity: z.number(),
  diskUsageReserved: z.number(),
  diskSpaceSchedulable: z.number(),
})

export type NodeResourceModel = z.infer<typeof nodeResourceZodModel>;