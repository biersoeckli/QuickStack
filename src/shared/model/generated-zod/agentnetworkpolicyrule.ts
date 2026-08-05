import * as z from "zod"

import { CompleteAgentNetworkPolicy, RelatedAgentNetworkPolicyModel, CompleteApp, RelatedAppModel } from "./index"

export const AgentNetworkPolicyRuleModel = z.object({
  id: z.string(),
  agentNetworkPolicyId: z.string(),
  type: z.string(),
  targetAppId: z.string(),
  port: z.number().int(),
  protocol: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export interface CompleteAgentNetworkPolicyRule extends z.infer<typeof AgentNetworkPolicyRuleModel> {
  agentNetworkPolicy: CompleteAgentNetworkPolicy
  targetApp: CompleteApp
}

/**
 * RelatedAgentNetworkPolicyRuleModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const RelatedAgentNetworkPolicyRuleModel: z.ZodSchema<CompleteAgentNetworkPolicyRule> = z.lazy(() => AgentNetworkPolicyRuleModel.extend({
  agentNetworkPolicy: RelatedAgentNetworkPolicyModel,
  targetApp: RelatedAppModel,
}))
