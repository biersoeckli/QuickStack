import { z } from "zod";
import { appBuildMethodZodModel } from "./app-source-info.model";
import { buildJobStatusEnumZod } from "./build-job";
import { zodWorkloadType } from "./runtime-type.model";

export const appBuildStatusEnumZod = z.union([buildJobStatusEnumZod, z.literal('NOT_BUILT')]);
export type AppBuildStatus = z.infer<typeof appBuildStatusEnumZod>;

export const appBuildStatusZodModel = z.object({
    workloadId: z.string(),
    workloadType: zodWorkloadType,
    workloadName: z.string(),
    projectId: z.string(),
    projectName: z.string(),
    status: appBuildStatusEnumZod,
    buildName: z.string().optional(),
    gitCommit: z.string().optional(),
    gitCommitMessage: z.string().optional(),
    deploymentId: z.string().optional(),
    buildMethod: appBuildMethodZodModel.optional(),
    startedAt: z.date().optional(),
    completionTime: z.date().optional(),
});

export type AppBuildStatusModel = z.infer<typeof appBuildStatusZodModel>;

export function isActiveBuildStatus(status: AppBuildStatus): boolean {
    return status === 'RUNNING' || status === 'PENDING';
}
