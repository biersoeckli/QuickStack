import { stringToOptionalNumber } from "@/shared/utils/zod.utils";
import { z } from "zod";

export const buildSettingsZodModel = z.object({
    memoryReservation: stringToOptionalNumber,
    memoryLimit: stringToOptionalNumber,
    cpuReservation: stringToOptionalNumber,
    cpuLimit: stringToOptionalNumber,
    buildNode: z.string().optional().nullable(),
});

export type BuildSettingsModel = z.infer<typeof buildSettingsZodModel>;
