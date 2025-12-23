import { stringToNumber } from "@/shared/utils/zod.utils";
import { z } from "zod";

export const appVolumeTypeZodModel = z.enum(["ReadWriteOnce", "ReadWriteMany"]);
export const storageClassNameZodModel = z.enum(["longhorn", "local-path"]);

export const appVolumeEditZodModel = z.object({
  containerMountPath: z.string().trim().min(1),
  size: stringToNumber,
  accessMode: appVolumeTypeZodModel.nullish().or(z.string().nullish()),
  storageClassName: storageClassNameZodModel.default("longhorn"),
});

export type AppVolumeEditModel = z.infer<typeof appVolumeEditZodModel>;
