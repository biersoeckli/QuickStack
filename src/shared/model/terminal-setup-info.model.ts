import { z } from "zod";

export const terminalSetupInfoZodModel = z.object({
    namespace: z.string().min(1),
    podName: z.string().min(1),
    containerName: z.string().min(1),
    terminalType: z.enum(['sh', 'bash', 'opencode']).default('bash').nullish(),
    terminalSessionKey: z.string().nullish(),
});

export type TerminalSetupInfoModel = z.infer<typeof terminalSetupInfoZodModel>;