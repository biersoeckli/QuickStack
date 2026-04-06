import { z } from "zod";
import { stringToNumber } from "@/shared/utils/zod.utils";

export const nodePortEditZodModel = z.object({
    port: stringToNumber.refine((val) => val >= 1 && val <= 65535, {
        message: 'Container port must be between 1 and 65535.',
    }),
    nodePort: stringToNumber.refine((val) => val >= 30001 && val <= 32767, {
        message: 'Node port must be between 30001 and 32767.', // these are the valid node port ranges in Kubernetes by default: https://kubernetes.io/docs/concepts/services-networking/service/#type-nodeport
    }),
    protocol: z.enum(['TCP', 'UDP']).default('TCP'),
});

export type NodePortEditModel = z.infer<typeof nodePortEditZodModel>;
