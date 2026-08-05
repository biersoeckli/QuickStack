import { z } from "zod";

export const userEditZodModel = z.object({
  id: z.string().trim().optional(),
  email: z.string().trim().min(1),
  newPassword: z.string().optional(),
  userGroupId: z.string().trim().nullable(),
  apiOnlyUser: z.boolean().optional().default(false),
})

export type UserEditModel = z.infer<typeof userEditZodModel>;
