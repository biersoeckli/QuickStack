import { stringToBoolean } from "@/shared/utils/zod.utils";
import { z } from "zod";

export const agentNetworkPolicySettingsZodModel = z.object({
    allowInternetAccess: stringToBoolean,
});

export type AgentNetworkPolicySettingsModel = z.infer<typeof agentNetworkPolicySettingsZodModel>;

export const agentNetworkPolicyEgressRuleEditZodModel = z.object({
    id: z.string().optional(),
    type: z.literal('EGRESS').default('EGRESS'),
    targetAppId: z.string().trim().min(1, 'Please select an app.'),
    port: z.union([z.string(), z.number()])
        .transform((val) => (typeof val === 'string' ? parseFloat(val) : val))
        .refine((val) => !isNaN(val) && val >= 1 && val <= 65535, {
            message: 'Port must be between 1 and 65535.',
        }),
    protocol: z.enum(['TCP', 'UDP']).default('TCP'),
});

export type AgentNetworkPolicyEgressRuleEditModel = z.infer<typeof agentNetworkPolicyEgressRuleEditZodModel>;
