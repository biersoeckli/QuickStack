import * as z from "zod"

import { CompleteUser, RelatedUserModel, CompleteRoleAppPermission, RelatedRoleAppPermissionModel } from "./index"

export const RoleModel = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullish(),
  canCreateNewApps: z.boolean(),
  canAccessBackups: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export interface CompleteRole extends z.infer<typeof RoleModel> {
  users: CompleteUser[]
  roleAppPermissions: CompleteRoleAppPermission[]
}

/**
 * RelatedRoleModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const RelatedRoleModel: z.ZodSchema<CompleteRole> = z.lazy(() => RoleModel.extend({
  users: RelatedUserModel.array(),
  roleAppPermissions: RelatedRoleAppPermissionModel.array(),
}))
