import * as z from "zod"

import { CompleteRole, RelatedRoleModel, CompleteApp, RelatedAppModel } from "./index"

export const RoleAppPermissionModel = z.object({
  id: z.string(),
  roleId: z.string(),
  appId: z.string(),
  permission: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export interface CompleteRoleAppPermission extends z.infer<typeof RoleAppPermissionModel> {
  role: CompleteRole
  app: CompleteApp
}

/**
 * RelatedRoleAppPermissionModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const RelatedRoleAppPermissionModel: z.ZodSchema<CompleteRoleAppPermission> = z.lazy(() => RoleAppPermissionModel.extend({
  role: RelatedRoleModel,
  app: RelatedAppModel,
}))
