import { z } from "zod";

export const podsInfoZodModel = z.object({
    podName: z.string(),
    containerName: z.string(),
    uid: z.string().optional(),
});

export type PodsInfoModel = z.infer<typeof podsInfoZodModel>;


