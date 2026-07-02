import * as z from "zod"

import { CompleteApp, RelatedAppModel, CompleteAgent, RelatedAgentModel, CompleteRoleProjectPermission, RelatedRoleProjectPermissionModel } from "./index"

export const ProjectModel = z.object({
  id: z.string(),
  name: z.string(),
  projectType: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export interface CompleteProject extends z.infer<typeof ProjectModel> {
  apps: CompleteApp[]
  agents: CompleteAgent[]
  roleProjectPermissions: CompleteRoleProjectPermission[]
}

/**
 * RelatedProjectModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const RelatedProjectModel: z.ZodSchema<CompleteProject> = z.lazy(() => ProjectModel.extend({
  apps: RelatedAppModel.array(),
  agents: RelatedAgentModel.array(),
  roleProjectPermissions: RelatedRoleProjectPermissionModel.array(),
}))
