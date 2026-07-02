import { stringToNumber } from "@/shared/utils/zod.utils";
import { z } from "zod";


const workloadPermissionZodModel = z.object({
  workloadId: z.string(),
  permission: z.string(),
});

const RoleProjectPermissionSchema = z.object({
  projectId: z.string(),
  createWorkloads: z.boolean(),
  deleteWorkloads: z.boolean(),
  writeWorkloads: z.boolean(),
  readWorkloads: z.boolean(),
  workloadPermissions: z.array(workloadPermissionZodModel).optional().default([]),
});

// Schema for UserRole.
export const roleEditZodModel = z.object({
  id: z.string().trim().optional(),
  name: z.string().trim().min(1),
  canAccessBackups: z.boolean().optional().default(false),
  roleProjectPermissions: z.array(RoleProjectPermissionSchema).optional().default([]),
});


export type RoleEditModel = z.infer<typeof roleEditZodModel>;
