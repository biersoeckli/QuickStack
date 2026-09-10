import { stringToBoolean } from "@/shared/utils/zod.utils";
import { z } from "zod";

export type NetworkPolicyDirection = 'INGRESS' | 'EGRESS';

export type NetworkPolicyTargetProject = {
    id: string;
    name: string;
};

export type NetworkPolicySelectableTarget = {
    id: string;
    name: string;
    type: 'APP' | 'AGENT';
    project: NetworkPolicyTargetProject;
};

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

export const appNetworkPolicyConfigurationZodModel = z.object({
    appId: z.string(),
    useNetworkPolicy: stringToBoolean,
    allowInternetAccess: stringToBoolean.optional().default(true),
    rules: z.array(appNetworkPolicyRuleEditZodModel).default([]),
});
export type AppNetworkPolicyConfigurationModel = z.infer<typeof appNetworkPolicyConfigurationZodModel>;
