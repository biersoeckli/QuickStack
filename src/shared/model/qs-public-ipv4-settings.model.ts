import { z } from "zod";

export const qsPublicIpv4SettingsZodModel = z.object({
  publicIpv4: z.string().trim(),
})

export type QsPublicIpv4SettingsModel = z.infer<typeof qsPublicIpv4SettingsZodModel>;