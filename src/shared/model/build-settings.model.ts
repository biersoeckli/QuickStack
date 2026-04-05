import { stringToOptionalNumber } from "@/shared/utils/zod.utils";
import { z } from "zod";

export const buildSettingsZodModel = z.object({
    memoryReservation: stringToOptionalNumber,
    memoryLimit: stringToOptionalNumber,
    cpuReservation: stringToOptionalNumber,
    cpuLimit: stringToOptionalNumber,
    buildNode: z.string().optional().nullable(),
    concurrencyLimit: stringToOptionalNumber,
});

export type BuildSettingsModel = z.infer<typeof buildSettingsZodModel>;
