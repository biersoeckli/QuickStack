import { z } from "zod";

export const healthCheckZodModel = z.object({
    appId: z.string(),
    enabled: z.boolean(),
    path: z.string().optional(), // If enabled is true, this might be required in reality, but we'll let user save empty
    port: z.coerce.number().int().min(1).max(65535).optional(),
    scheme: z.enum(["HTTP", "HTTPS"]).optional(),
    periodSeconds: z.coerce.number().int().min(1).default(10),
    timeoutSeconds: z.coerce.number().int().min(1).default(5),
    headers: z.array(z.object({
        name: z.string().min(1, "Name is required"),
        value: z.string().min(1, "Value is required")
    })).optional()
});

export type HealthCheckModel = z.infer<typeof healthCheckZodModel>;
