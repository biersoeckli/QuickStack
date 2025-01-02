import { stringToNumber } from "@/shared/utils/zod.utils";
import { z } from "zod";

export const volumeBackupEditZodModel = z.object({
  id: z.string().nullable(),
  volumeId: z.string(),
  targetId: z.string(),
  cron: z.string().trim().regex(/^ *(\*|[0-5]?\d) *(\*|[01]?\d) *(\*|[0-2]?\d) *(\*|[0-6]?\d) *(\*|[0-6]?\d) *$/),
  //cron: z.string().trim().min(1),
  retention: stringToNumber,
});

export type VolumeBackupEditModel = z.infer<typeof volumeBackupEditZodModel>;