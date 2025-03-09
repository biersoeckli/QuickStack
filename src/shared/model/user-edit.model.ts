import { stringToNumber } from "@/shared/utils/zod.utils";
import { z } from "zod";

export const userEditZodModel = z.object({
  id: z.string().trim().optional(),
  email: z.string().trim().min(1),
  newPassword: z.string().optional(),
  roleId: z.string().trim().nullable(),
})

export type UserEditModel = z.infer<typeof userEditZodModel>;
