import { stringToOptionalNumber } from "@/shared/utils/zod.utils";
import { z } from "zod";

export const appContainerConfigZodModel = z.object({
  containerCommand: z.string().trim().nullish(),
  containerArgs: z.array(z.object({
    value: z.string().trim()
  })).optional(),
  securityContextRunAsUser: stringToOptionalNumber,
  securityContextRunAsGroup: stringToOptionalNumber,
  securityContextFsGroup: stringToOptionalNumber,
});

export type AppContainerConfigModel = z.infer<typeof appContainerConfigZodModel>;