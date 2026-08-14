import * as z from "zod"

import { CompleteAppNetworkPolicy, RelatedAppNetworkPolicyModel, CompleteApp, RelatedAppModel, CompleteAgent, RelatedAgentModel } from "./index"

export const AppNetworkPolicyRuleModel = z.object({
  id: z.string(),
  appNetworkPolicyId: z.string(),
  type: z.string(),
  targetAppId: z.string().nullish(),
  targetAgentId: z.string().nullish(),
  port: z.number().int(),
  protocol: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export interface CompleteAppNetworkPolicyRule extends z.infer<typeof AppNetworkPolicyRuleModel> {
  appNetworkPolicy: CompleteAppNetworkPolicy
  targetApp?: CompleteApp | null
  targetAgent?: CompleteAgent | null
}

/**
 * RelatedAppNetworkPolicyRuleModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const RelatedAppNetworkPolicyRuleModel: z.ZodSchema<CompleteAppNetworkPolicyRule> = z.lazy(() => AppNetworkPolicyRuleModel.extend({
  appNetworkPolicy: RelatedAppNetworkPolicyModel,
  targetApp: RelatedAppModel.nullish(),
  targetAgent: RelatedAgentModel.nullish(),
}))
