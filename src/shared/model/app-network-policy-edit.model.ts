import { stringToBoolean } from "@/shared/utils/zod.utils";
import { z } from "zod";

export const appNetworkPolicySettingsZodModel = z.object({
    mode: z.enum(['SIMPLE', 'EXTENDED']),
    useNetworkPolicy: stringToBoolean,
    allowInternetAccess: stringToBoolean.optional().default(true),
});
export type AppNetworkPolicySettingsModel = z.infer<typeof appNetworkPolicySettingsZodModel>;

export const appNetworkPolicyRuleEditZodModel = z.object({
    id: z.string().optional(),
    type: z.enum(['INGRESS', 'EGRESS']),
    targetType: z.enum(['APP', 'AGENT']),
    targetId: z.string().trim().min(1, 'Please select a target.'),
    port: z.union([z.string(), z.number()]).transform((value) => typeof value === 'string' ? parseInt(value, 10) : value)
        .refine((value) => Number.isInteger(value) && value >= 1 && value <= 65535, 'Port must be between 1 and 65535.'),
    protocol: z.enum(['TCP', 'UDP']).default('TCP'),
});
export type AppNetworkPolicyRuleEditModel = z.infer<typeof appNetworkPolicyRuleEditZodModel>;
