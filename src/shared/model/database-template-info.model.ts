import { z } from "zod";

export const databaseTemplateInfoZodModel = z.object({
    username: z.string(),
    password: z.string(),
    port: z.number(),
    hostname: z.string(),
    databaseName: z.string(),
    internalConnectionUrl: z.string(),
});

export type DatabaseTemplateInfoModel = z.infer<typeof databaseTemplateInfoZodModel>;
