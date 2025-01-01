import { stringToBoolean } from "@/shared/utils/zod.utils";
import { z } from "zod";

export const registryStorageLocationSettingsZodModel = z.object({
  registryStorageLocation: z.string(),
})

export type RegistryStorageLocationSettingsModel = z.infer<typeof registryStorageLocationSettingsZodModel>;