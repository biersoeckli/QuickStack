import * as z from "zod"

import { CompleteVolumeBackup, RelatedVolumeBackupModel } from "./index"

export const S3TargetModel = z.object({
  id: z.string(),
  name: z.string(),
  bucketName: z.string(),
  endpoint: z.string(),
  region: z.string(),
  accessKeyId: z.string(),
  secretKey: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export interface CompleteS3Target extends z.infer<typeof S3TargetModel> {
  volumeBackups: CompleteVolumeBackup[]
}

/**
 * RelatedS3TargetModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const RelatedS3TargetModel: z.ZodSchema<CompleteS3Target> = z.lazy(() => S3TargetModel.extend({
  volumeBackups: RelatedVolumeBackupModel.array(),
}))
