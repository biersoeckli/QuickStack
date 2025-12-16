import { z } from "zod";

export const appNetworkPolicy = z.enum(["ALLOW_ALL", "NAMESPACE_ONLY", "DENY_ALL"]);
export type AppNetworkPolicyType = z.infer<typeof appNetworkPolicy>;