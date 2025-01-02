import { z } from "zod";
import { S3TargetModel, VolumeBackupModel } from "./generated-zod";

export const volumeBackupExtendedZodModel = z.lazy(() => VolumeBackupModel.extend({
  target: S3TargetModel
}))

export type VolumeBackupExtendedModel = z.infer<typeof volumeBackupExtendedZodModel>;
