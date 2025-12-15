import { z } from "zod";

export const systemBackupLocationSettingsZodModel = z.object({
  systemBackupLocation: z.string(),
})

export type SystemBackupLocationSettingsModel = z.infer<typeof systemBackupLocationSettingsZodModel>;
