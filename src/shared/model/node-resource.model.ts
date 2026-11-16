import { z } from 'zod';

export const nodeResourceZodModel = z.object({
  name: z.string(),
  measuredAt: z.date().nullable().optional(),
  cpuUsage: z.number().nullable(),
  cpuCapacity: z.number(),
  ramUsage: z.number().nullable(),
  ramCapacity: z.number(),
  diskUsageAbsolut: z.number().optional(),
  diskUsageCapacity: z.number().optional(),
  diskUsageAvailable: z.number().optional()
});

export type NodeResourceModel = z.infer<typeof nodeResourceZodModel>;
