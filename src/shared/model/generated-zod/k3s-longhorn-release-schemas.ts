import { z } from 'zod';

export const K3sReleaseInfoSchema = z.object({
    version: z.string(),
    channelUrl: z.string().url(),
});

export const LonghornReleaseInfoSchema = z.object({
    version: z.string(),
    yamlUrl: z.string().url(),
});

export const ReleaseResponseSchema = z.object({
    prodInstallVersion: z.string(),
    canaryInstallVersion: z.string(),
});

export const K3sReleaseResponseSchema = ReleaseResponseSchema.extend({
    prod: K3sReleaseInfoSchema.array(),
    canary: K3sReleaseInfoSchema.array(),
});

export const LonghornReleaseResponseSchema = ReleaseResponseSchema.extend({
    prod: LonghornReleaseInfoSchema.array(),
    canary: LonghornReleaseInfoSchema.array(),
});
