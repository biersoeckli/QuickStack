import { stringToNumber, stringToOptionalNumber } from "@/lib/zod.utils";
import { z } from "zod";

export const appRateLimitsZodModel = z.object({
  memoryReservation: stringToOptionalNumber,
  memoryLimit: stringToOptionalNumber,
  cpuReservation: stringToOptionalNumber,
  cpuLimit: stringToOptionalNumber,
  replicas: stringToNumber,
})

export type AppRateLimitsModel = z.infer<typeof appRateLimitsZodModel>;