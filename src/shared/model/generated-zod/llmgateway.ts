import * as z from "zod"


export const LlmGatewayModel = z.object({
  id: z.string(),
  name: z.string(),
  baseUrl: z.string(),
  encryptedAdminKey: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
})
