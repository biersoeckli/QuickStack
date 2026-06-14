import z from "zod";

export const appLogEntryZodModel = z.object({
    podName: z.string(),
    containerName: z.string(),
    logs: z.string(),
});

export const appLogsResponseZodModel = z.object({
    appId: z.string(),
    lines: z.number().int().positive(),
    logs: z.array(appLogEntryZodModel),
});

export const appDeploymentLogsResponseZodModel = z.object({
    appId: z.string(),
    deplyomentId: z.string(),
    tailLines: z.number().int().positive().nullable(),
    logs: z.string(),
});

export type AppLogEntryModel = z.infer<typeof appLogEntryZodModel>;
