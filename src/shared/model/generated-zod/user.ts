import * as z from "zod"

import { CompleteRole, RelatedRoleModel, CompleteAccount, RelatedAccountModel, CompleteSession, RelatedSessionModel, CompleteAuthenticator, RelatedAuthenticatorModel } from "./index"

export const UserModel = z.object({
  id: z.string(),
  name: z.string().nullish(),
  email: z.string(),
  emailVerified: z.date().nullish(),
  password: z.string(),
  twoFaSecret: z.string().nullish(),
  twoFaEnabled: z.boolean(),
  image: z.string().nullish(),
  roleId: z.string().nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export interface CompleteUser extends z.infer<typeof UserModel> {
  role?: CompleteRole | null
  accounts: CompleteAccount[]
  sessions: CompleteSession[]
  Authenticator: CompleteAuthenticator[]
}

/**
 * RelatedUserModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const RelatedUserModel: z.ZodSchema<CompleteUser> = z.lazy(() => UserModel.extend({
  role: RelatedRoleModel.nullish(),
  accounts: RelatedAccountModel.array(),
  sessions: RelatedSessionModel.array(),
  Authenticator: RelatedAuthenticatorModel.array(),
}))
