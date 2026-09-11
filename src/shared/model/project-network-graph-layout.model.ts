import { z } from 'zod';

export const networkGraphPositionSchema = z.object({
    x: z.number().finite(),
    y: z.number().finite(),
});

export const projectNetworkGraphPositionSchema = networkGraphPositionSchema.extend({
    nodeId: z.string().min(1).max(255),
});

export type NetworkGraphPosition = z.infer<typeof networkGraphPositionSchema>;
export type ProjectNetworkGraphPositionInput = z.infer<typeof projectNetworkGraphPositionSchema>;
export type ProjectNetworkGraphPositions = Record<string, NetworkGraphPosition>;
