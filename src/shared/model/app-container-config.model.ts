import { stringToOptionalNumber } from "@/shared/utils/zod.utils";
import { z } from "zod";

export const containerCommandArgsZodModel = z.object({
  containerCommand: z.string().trim().nullish(),
  containerArgs: z.array(z.object({
    value: z.string().trim()
  })).optional(),
});

export const appContainerConfigZodModel = z.object({
  ...containerCommandArgsZodModel.shape,
  securityContextRunAsUser: stringToOptionalNumber,
  securityContextRunAsGroup: stringToOptionalNumber,
  securityContextFsGroup: stringToOptionalNumber,
  securityContextPrivileged: z.boolean().default(false),
});

export type AppContainerConfigModel = z.infer<typeof appContainerConfigZodModel>;
