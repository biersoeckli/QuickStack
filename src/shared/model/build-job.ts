import { GitCommit } from "lucide-react";
import { z } from "zod";

export const buildJobStatusEnumZod = z.union([z.literal('UNKNOWN'), z.literal('RUNNING'), z.literal('FAILED'), z.literal('SUCCEEDED')]);

export const buildJobSchemaZod = z.object({
    name: z.string(),
    startTime: z.date(),
    status:  buildJobStatusEnumZod,
    gitCommit: z.string(),
    gitCommitMessage: z.string().optional(),
    deploymentId: z.string(),
});

export type BuildJobModel = z.infer<typeof buildJobSchemaZod>;
export type BuildJobStatus = z.infer<typeof buildJobStatusEnumZod>;


