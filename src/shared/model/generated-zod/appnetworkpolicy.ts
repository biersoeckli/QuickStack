import * as z from "zod"

import { CompleteApp, RelatedAppModel, CompleteAppNetworkPolicyRule, RelatedAppNetworkPolicyRuleModel } from "./index"

export const AppNetworkPolicyModel = z.object({
  id: z.string(),
  appId: z.string(),
  allowInternetAccess: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export interface CompleteAppNetworkPolicy extends z.infer<typeof AppNetworkPolicyModel> {
  app: CompleteApp
  rules: CompleteAppNetworkPolicyRule[]
}

/**
 * RelatedAppNetworkPolicyModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const RelatedAppNetworkPolicyModel: z.ZodSchema<CompleteAppNetworkPolicy> = z.lazy(() => AppNetworkPolicyModel.extend({
  app: RelatedAppModel,
  rules: RelatedAppNetworkPolicyRuleModel.array(),
}))
