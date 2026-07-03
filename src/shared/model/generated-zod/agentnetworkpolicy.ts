import * as z from "zod"

import { CompleteAgent, RelatedAgentModel, CompleteAgentNetworkPolicyRule, RelatedAgentNetworkPolicyRuleModel } from "./index"

export const AgentNetworkPolicyModel = z.object({
  id: z.string(),
  agentId: z.string(),
  allowInternetAccess: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export interface CompleteAgentNetworkPolicy extends z.infer<typeof AgentNetworkPolicyModel> {
  agent: CompleteAgent
  rules: CompleteAgentNetworkPolicyRule[]
}

/**
 * RelatedAgentNetworkPolicyModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const RelatedAgentNetworkPolicyModel: z.ZodSchema<CompleteAgentNetworkPolicy> = z.lazy(() => AgentNetworkPolicyModel.extend({
  agent: RelatedAgentModel,
  rules: RelatedAgentNetworkPolicyRuleModel.array(),
}))
