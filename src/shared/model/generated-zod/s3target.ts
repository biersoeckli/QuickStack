import * as z from "zod"


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
