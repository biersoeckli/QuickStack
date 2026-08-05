import * as z from "zod"

import { CompleteAgent, RelatedAgentModel, CompleteRoleProjectPermission, RelatedRoleProjectPermissionModel } from "./index"

export const RoleAgentPermissionModel = z.object({
  id: z.string(),
  agentId: z.string(),
  permission: z.string(),
  roleProjectPermissionId: z.string().nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export interface CompleteRoleAgentPermission extends z.infer<typeof RoleAgentPermissionModel> {
  agent: CompleteAgent
  roleProjectPermission?: CompleteRoleProjectPermission | null
}

/**
 * RelatedRoleAgentPermissionModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const RelatedRoleAgentPermissionModel: z.ZodSchema<CompleteRoleAgentPermission> = z.lazy(() => RoleAgentPermissionModel.extend({
  agent: RelatedAgentModel,
  roleProjectPermission: RelatedRoleProjectPermissionModel.nullish(),
}))
