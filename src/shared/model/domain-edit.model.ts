import { stringToBoolean, stringToNumber } from "@/shared/utils/zod.utils";
import { z } from "zod";

export const domainEditZodModel = z.object({
  id: z.string().optional(),
  hostname: z.string().trim().min(1),
  useSsl: stringToBoolean,
  redirectHttps: stringToBoolean,
  port: stringToNumber,
})

export type DomainEditModel = z.infer<typeof domainEditZodModel>;