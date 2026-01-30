import { z } from "zod";

export const healthCheckZodModel = z.object({
    appId: z.string(),
    enabled: z.boolean(),
    probeType: z.enum(["HTTP", "TCP"]).default("HTTP"),
    // HTTP probe fields
    path: z.string().optional(),
    httpPort: z.coerce.number().int().min(1).max(65535).optional(),
    scheme: z.enum(["HTTP", "HTTPS"]).optional(),
    headers: z.array(z.object({
        name: z.string().min(1, "Name is required"),
        value: z.string().min(1, "Value is required")
    })).optional(),
    // TCP probe fields
    tcpPort: z.coerce.number().int().min(1).max(65535).optional(),
    // Common fields
    periodSeconds: z.coerce.number().int().min(1).default(15),
    timeoutSeconds: z.coerce.number().int().min(1).default(5),
    failureThreshold: z.coerce.number().int().min(1).default(3),
});

export type HealthCheckModel = z.infer<typeof healthCheckZodModel>;
