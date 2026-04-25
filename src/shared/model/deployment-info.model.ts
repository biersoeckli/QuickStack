import { z } from "zod";
import { appBuildMethodZodModel } from "./app-source-info.model";

export const deploymentStatusEnumZod = z.union([
    z.literal('UNKNOWN'),
    z.literal('BUILDING'),
    z.literal('ERROR'),
    z.literal('DEPLOYED'),
    z.literal('DEPLOYING'),
    z.literal('SHUTDOWN'),
    z.literal('SHUTTING_DOWN'),
    z.literal('PENDING'),
]);

export const deploymentInfoZodModel = z.object({
    replicasetName: z.string().optional(),
    buildJobName: z.string().optional(),
    createdAt: z.date(),
    status: deploymentStatusEnumZod,
    gitCommit: z.string().optional(),
    gitCommitMessage: z.string().optional(),
    deploymentId: z.string(),
    buildMethod: appBuildMethodZodModel.optional(),
});

export type DeploymentInfoModel = z.infer<typeof deploymentInfoZodModel>;
export type DeploymentStatus = z.infer<typeof deploymentStatusEnumZod>;

