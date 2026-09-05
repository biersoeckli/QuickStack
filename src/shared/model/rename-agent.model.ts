import { z } from "zod";

export const renameAgentZodModel = z.object({
    name: z.string().trim().min(1),
});

export type RenameAgentModel = z.infer<typeof renameAgentZodModel>;
