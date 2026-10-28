import { z } from "zod";

export const liteLlmMetadataObjectZodModel = z.record(z.string(), z.unknown());

export const liteLlmMetadataStringZodModel = z.string()
    .trim()
    .min(1);

export const liteLlmMetadataNumberZodModel = z.union([
    z.number(),
    z.string().trim().min(1),
])
    .transform((value) => Number(value))
    .pipe(z.number().finite().positive());

export const liteLlmMetadataBooleanZodModel = z.preprocess((value) => {
    if (typeof value !== 'string') {
        return value;
    }

    if (value.toLowerCase() === 'true') {
        return true;
    }

    if (value.toLowerCase() === 'false') {
        return false;
    }

    return value;
}, z.boolean());
