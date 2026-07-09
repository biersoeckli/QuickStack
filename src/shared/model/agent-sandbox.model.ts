import { z } from "zod";
import { deploymentStatusEnumZod } from "./deployment-info.model";

export const agentSandboxZodModel = z.object({
    agentId: z.string(),
    claimName: z.string(),
    sandboxName: z.string(),
    podName: z.string(),
    namespace: z.string(),
    status: deploymentStatusEnumZod,
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

export const fileReadResultZodModel = z.object({
    dataBase64: z.string(),
});

export const fileTextReadResultZodModel = z.object({
    text: z.string(),
});

export const fileExistsResultZodModel = z.object({
    exists: z.boolean(),
});

const envNameZodModel = z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/);

export const createSandboxRequestZodModel = z.object({
    env: z.record(envNameZodModel, z.string()).optional(),
    idleTimeoutMinutes: z.number().int().positive().max(1440).optional(),
}).optional().default({});

export const commandRequestZodModel = z.object({
    command: z.string().min(1),
    cwd: z.string().min(1).optional(),
    timeoutSec: z.number().int().positive().max(3600).optional(),
    env: z.record(envNameZodModel, z.string()).optional(),
});

export const fileWriteRequestZodModel = z.object({
    path: z.string().min(1),
    dataBase64: z.string(),
});

export const fileTextWriteRequestZodModel = z.object({
    path: z.string().min(1),
    text: z.string(),
});

export type AgentSandboxModel = z.infer<typeof agentSandboxZodModel>;
export type CommandResultModel = z.infer<typeof commandResultZodModel>;
export type FileEntryModel = z.infer<typeof fileEntryZodModel>;
export type FileReadResultModel = z.infer<typeof fileReadResultZodModel>;
export type FileTextReadResultModel = z.infer<typeof fileTextReadResultZodModel>;
export type FileExistsResultModel = z.infer<typeof fileExistsResultZodModel>;
export type CreateSandboxRequestModel = z.infer<typeof createSandboxRequestZodModel>;
export type CommandRequestModel = z.infer<typeof commandRequestZodModel>;
