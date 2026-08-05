import { stringToNumber } from "@/shared/utils/zod.utils";
import { z } from "zod";

export const appPortZodModel = z.object({
  port: stringToNumber,
});

export type AppPortModel = z.infer<typeof appPortZodModel>;