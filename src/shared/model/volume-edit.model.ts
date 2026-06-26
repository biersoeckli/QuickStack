import { stringToNumber } from "@/shared/utils/zod.utils";
import { z } from "zod";

export const appVolumeTypeZodModel = z.enum(["ReadWriteOnce", "ReadWriteMany"]);
export const appStorageClassNameZodModel = z.enum(["longhorn", "local-path"]);
export const agentStorageClassNameZodModel = z.enum(["longhorn"]); // only rwx models

export const agentVolumeEditZodModel = z.object({
  containerMountPath: z.string().trim().min(1),
  size: stringToNumber,
  storageClassName: agentStorageClassNameZodModel.default("longhorn"),
});

export type AgentVolumeEditModel = z.infer<typeof agentVolumeEditZodModel>;

export const appVolumeEditZodModel = z.object({
  containerMountPath: z.string().trim().min(1),
  size: stringToNumber,
  accessMode: appVolumeTypeZodModel.nullish().or(z.string().nullish()),
  storageClassName: appStorageClassNameZodModel.default("longhorn"),
  shareWithOtherApps: z.boolean().optional().default(false),
  sharedVolumeId: z.string().nullish(),
});

export type AppVolumeEditModel = z.infer<typeof appVolumeEditZodModel>;
