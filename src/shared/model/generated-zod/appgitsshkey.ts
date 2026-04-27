import * as z from "zod"

import { CompleteApp, RelatedAppModel } from "./index"

export const AppGitSshKeyModel = z.object({
  id: z.string(),
  appId: z.string(),
  publicKey: z.string(),
  encryptedPrivateKey: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export interface CompleteAppGitSshKey extends z.infer<typeof AppGitSshKeyModel> {
  app: CompleteApp
}

/**
 * RelatedAppGitSshKeyModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const RelatedAppGitSshKeyModel: z.ZodSchema<CompleteAppGitSshKey> = z.lazy(() => AppGitSshKeyModel.extend({
  app: RelatedAppModel,
}))
