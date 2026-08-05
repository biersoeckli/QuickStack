import { z } from "zod";
import { deploymentStatusEnumZod } from "./deployment-info.model";

export const agentSandboxZodModel = z.object({
    agentId: z.string(),
    sandboxName: z.string(),
    podName: z.string(),
    namespace: z.string(),
    status: deploymentStatusEnumZod,
    customTag: z.string().nullable(),
    createdAt: z.string().datetime().nullable(),
});

export const commandResultZodModel = z.object({
    stdout: z.string(),
    stderr: z.string(),
    exitCode: z.number().int(),
});

export const fileEntryZodModel = z.object({
    name: z.string(),
    path: z.string(),
    type: z.union([z.literal('file'), z.literal('directory'), z.literal('other')]),
    size: z.number().int().nonnegative().optional(),
    modifiedAt: z.string().datetime().optional(),
});

export const fileExistsResultZodModel = z.object({
    exists: z.boolean(),
});

const envNameZodModel = z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/);

export const createSandboxRequestZodModel = z.object({
    env: z.record(envNameZodModel, z.string()).optional(),
    idleTimeoutMinutes: z.number().int().positive().max(1440).optional(),
    customTag: z.string().min(1).optional(),
}).optional().default({});

export const commandRequestZodModel = z.object({
    command: z.string().min(1),
    cwd: z.string().min(1).optional(),
    timeoutSec: z.number().int().positive().max(3600).default(120).optional(),
    env: z.record(envNameZodModel, z.string()).optional(),
});

export const agentSandboxAccessUrlZodModel = z.object({
    url: z.string(),
    expiresAt: z.number().int().positive(),
});

export type AgentSandboxModel = z.infer<typeof agentSandboxZodModel>;
export type CommandResultModel = z.infer<typeof commandResultZodModel>;
export type FileEntryModel = z.infer<typeof fileEntryZodModel>;
export type FileExistsResultModel = z.infer<typeof fileExistsResultZodModel>;
export type CreateSandboxRequestModel = z.infer<typeof createSandboxRequestZodModel>;
export type CommandRequestModel = z.infer<typeof commandRequestZodModel>;
