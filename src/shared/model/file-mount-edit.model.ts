import { z } from "zod";

export const fileMountEditZodModel = z.object({
  containerMountPath: z.string().trim().min(1),
  content: z.string().min(1),
})

export type FileMountEditModel = z.infer<typeof fileMountEditZodModel>;