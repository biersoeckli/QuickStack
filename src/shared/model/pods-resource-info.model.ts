import { z } from "zod";

export const podsResourceInfoZodModel = z.object({
    cpuPercent: z.number(),
    cpuAbsolutCores: z.number(),
    ramPercent: z.number(),
    ramAbsolutBytes: z.number(),
});

export type PodsResourceInfoModel = z.infer<typeof podsResourceInfoZodModel>;


