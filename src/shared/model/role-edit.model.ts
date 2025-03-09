import { stringToNumber } from "@/shared/utils/zod.utils";
import { z } from "zod";

export const roleEditZodModel = z.object({
  id: z.string().trim().optional(),
  name: z.string().trim().min(1),
  canCreateNewApps: z.boolean().optional().default(false),
  canAccessBackups: z.boolean().optional().default(false),
  roleAppPermissions: z.array(z.object({
    appId: z.string(),
    permission: z.string(),
  })).optional(),
})

export type RoleEditModel = z.infer<typeof roleEditZodModel>;
