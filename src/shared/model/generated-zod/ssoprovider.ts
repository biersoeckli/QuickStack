import * as z from "zod"

import { SsoProviderType } from "@prisma/client"
import { CompleteUserGroup, RelatedUserGroupModel } from "./index"

export const SsoProviderModel = z.object({
  id: z.string(),
  type: z.nativeEnum(SsoProviderType),
  name: z.string(),
  enabled: z.boolean(),
  clientId: z.string(),
  clientSecretEnc: z.string(),
  issuer: z.string().nullish(),
  tenantId: z.string().nullish(),
  defaultUserGroupId: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export interface CompleteSsoProvider extends z.infer<typeof SsoProviderModel> {
  defaultUserGroup: CompleteUserGroup
}

/**
 * RelatedSsoProviderModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const RelatedSsoProviderModel: z.ZodSchema<CompleteSsoProvider> = z.lazy(() => SsoProviderModel.extend({
  defaultUserGroup: RelatedUserGroupModel,
}))
