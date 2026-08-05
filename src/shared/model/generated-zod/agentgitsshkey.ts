import * as z from "zod"

import { CompleteAgent, RelatedAgentModel } from "./index"

export const AgentGitSshKeyModel = z.object({
  id: z.string(),
  agentId: z.string(),
  publicKey: z.string(),
  encryptedPrivateKey: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export interface CompleteAgentGitSshKey extends z.infer<typeof AgentGitSshKeyModel> {
  agent: CompleteAgent
}

/**
 * RelatedAgentGitSshKeyModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const RelatedAgentGitSshKeyModel: z.ZodSchema<CompleteAgentGitSshKey> = z.lazy(() => AgentGitSshKeyModel.extend({
  agent: RelatedAgentModel,
}))
