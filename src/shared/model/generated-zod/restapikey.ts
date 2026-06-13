import * as z from "zod"

import { CompleteUser, RelatedUserModel } from "./index"

export const RestApiKeyModel = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  keyHash: z.string(),
  expiresAt: z.date().nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export interface CompleteRestApiKey extends z.infer<typeof RestApiKeyModel> {
  user: CompleteUser
}

/**
 * RelatedRestApiKeyModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const RelatedRestApiKeyModel: z.ZodSchema<CompleteRestApiKey> = z.lazy(() => RestApiKeyModel.extend({
  user: RelatedUserModel,
}))
