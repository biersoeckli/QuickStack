import { z } from "zod";

export const s3TargetEditZodModel = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1),
  endpoint: z.string().trim().min(1),
  bucketName: z.string().trim().min(1),
  region: z.string().trim().min(1),
  accessKeyId: z.string().trim().min(1),
  secretKey: z.string().trim().min(1),
  useSsl: z.boolean().optional().default(true),
  v4Auth: z.boolean().optional().default(true),
  forcePathStyle: z.boolean().optional().default(false),
})

export type S3TargetEditModel = z.infer<typeof s3TargetEditZodModel>;
