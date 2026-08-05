import * as z from "zod"

import { CompleteUserGroup, RelatedUserGroupModel, CompleteProject, RelatedProjectModel, CompleteRoleAppPermission, RelatedRoleAppPermissionModel, CompleteRoleAgentPermission, RelatedRoleAgentPermissionModel } from "./index"

export const RoleProjectPermissionModel = z.object({
  id: z.string(),
  userGroupId: z.string(),
  projectId: z.string(),
  createApps: z.boolean(),
  deleteApps: z.boolean(),
  writeApps: z.boolean(),
  readApps: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export interface CompleteRoleProjectPermission extends z.infer<typeof RoleProjectPermissionModel> {
  userGroup: CompleteUserGroup
  project: CompleteProject
  roleAppPermissions: CompleteRoleAppPermission[]
  roleAgentPermissions: CompleteRoleAgentPermission[]
}

/**
 * RelatedRoleProjectPermissionModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const RelatedRoleProjectPermissionModel: z.ZodSchema<CompleteRoleProjectPermission> = z.lazy(() => RoleProjectPermissionModel.extend({
  userGroup: RelatedUserGroupModel,
  project: RelatedProjectModel,
  roleAppPermissions: RelatedRoleAppPermissionModel.array(),
  roleAgentPermissions: RelatedRoleAgentPermissionModel.array(),
}))
