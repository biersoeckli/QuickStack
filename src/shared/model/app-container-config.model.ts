import { stringToNumber, stringToOptionalNumber } from "@/shared/utils/zod.utils";
import { z } from "zod";

export const appContainerConfigZodModel = z.object({
  containerCommand: z.string().trim().nullish(),
  containerArgs: z.array(z.object({
    value: z.string().trim()
  })).optional(),
});

export type AppContainerConfigModel = z.infer<typeof appContainerConfigZodModel>;