import * as z from "zod"

import { CompleteAppVolume, RelatedAppVolumeModel, CompleteS3Target, RelatedS3TargetModel } from "./index"

export const VolumeBackupModel = z.object({
  id: z.string(),
  volumeId: z.string(),
  targetId: z.string(),
  cron: z.string(),
  retention: z.number().int(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export interface CompleteVolumeBackup extends z.infer<typeof VolumeBackupModel> {
  volume: CompleteAppVolume
  target: CompleteS3Target
}

/**
 * RelatedVolumeBackupModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const RelatedVolumeBackupModel: z.ZodSchema<CompleteVolumeBackup> = z.lazy(() => VolumeBackupModel.extend({
  volume: RelatedAppVolumeModel,
  target: RelatedS3TargetModel,
}))
