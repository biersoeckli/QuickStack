import { stringToNumber } from "@/shared/utils/zod.utils";
import { z } from "zod";

export const volumeBackupEditZodModel = z.object({
  id: z.string().nullish(),
  volumeId: z.string(),
  targetId: z.string(),
  cron: z.string().trim().regex(/(@(annually|yearly|monthly|weekly|daily|hourly|reboot))|(@every (\d+(ns|us|µs|ms|s|m|h))+)|((((\d+,)+\d+|(\d+(\/|-)\d+)|\d+|\*) ?){5,7})/),
  //cron: z.string().trim().min(1),
  retention: stringToNumber,
  useDatabaseBackup: z.boolean().optional(),
});

export type VolumeBackupEditModel = z.infer<typeof volumeBackupEditZodModel>;