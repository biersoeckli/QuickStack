import { z } from 'zod';

export const restApiKeyCreateZodModel = z.object({
    name: z.string().min(1),
    expiresAt: z.coerce.date<string | number | Date>().nullable().optional(),
});

export type RestApiKeyCreateModel = z.infer<typeof restApiKeyCreateZodModel>;
