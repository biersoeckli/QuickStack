import { z } from "zod";
import { buildJobSchemaZod } from "./build-job";

export const globalBuildJobSchemaZod = buildJobSchemaZod.extend({
    projectId: z.string(),
    workloadName: z.string(),
    projectName: z.string(),
    completionTime: z.date().optional(),
});

export type GlobalBuildJobModel = z.infer<typeof globalBuildJobSchemaZod>;
