import { stringToNumber } from "@/shared/utils/zod.utils";
import { z } from "zod";

export const appVolumeTypeZodModel = z.enum(["ReadWriteOnce", "ReadWriteMany"]);
export const appStorageClassNameZodModel = z.string().trim().min(1);
export const agentStorageClassNameZodModel = z.string().trim().min(1);

export const agentVolumeTypeZodModel = z.enum(["ALL", "PER_SANDBOX"]);
export const agentVolumeAccessModeZodModel = z.enum(["ReadWriteOnce", "ReadWriteMany"]);

export const agentVolumeEditZodModel = z.object({
  containerMountPath: z.string().trim().min(1),
  size: stringToNumber,
  storageClassName: agentStorageClassNameZodModel.default("longhorn"),
  volumeType: agentVolumeTypeZodModel.optional(),
  accessMode: agentVolumeAccessModeZodModel.optional(),
});

export type AgentVolumeEditModel = z.infer<typeof agentVolumeEditZodModel>;
export type AgentVolumeType = z.infer<typeof agentVolumeTypeZodModel>;
export type AgentVolumeAccessMode = z.infer<typeof agentVolumeAccessModeZodModel>;

export type AgentVolumeSaveModel = {
  agentId: string;
  id?: string;
  containerMountPath: string;
  size: number;
  storageClassName: string;
  volumeType?: string;
  accessMode?: string;
};

export const appVolumeEditZodModel = z.object({
  containerMountPath: z.string().trim().min(1),
  size: stringToNumber,
  accessMode: appVolumeTypeZodModel.nullish().or(z.string().nullish()),
  storageClassName: appStorageClassNameZodModel.default("longhorn"),
  shareWithOtherApps: z.boolean().optional().default(false),
  sharedVolumeId: z.string().nullish(),
});

export type AppVolumeEditModel = z.infer<typeof appVolumeEditZodModel>;
