import { stringToBoolean } from "@/lib/zod.utils";
import { z } from "zod";

export const qsLetsEncryptSettingsZodModel = z.object({
  letsEncryptMail: z.string().trim().email(),
})

export type QsLetsEncryptSettingsModel = z.infer<typeof qsLetsEncryptSettingsZodModel>;