import { z } from "zod";

export const volumeUploadZodModel = z.object({
  file: z.any(),
  volumeId: z.string(),
})

export type VolumeUploadModel = z.infer<typeof volumeUploadZodModel>;