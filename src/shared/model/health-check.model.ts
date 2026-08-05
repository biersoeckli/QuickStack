import { z } from "zod";

export const healthCheckZodModel = z.object({
    workloadId: z.string(),
    enabled: z.boolean(),
    probeType: z.enum(["HTTP", "TCP"]).default("HTTP"),
    path: z.string().optional(),
    httpPort: z.coerce.number<string | number>().int().min(1).max(65535).optional(),
    scheme: z.enum(["HTTP", "HTTPS"]).optional(),
    headers: z.array(z.object({
        name: z.string().min(1, "Name is required"),
        value: z.string().min(1, "Value is required"),
    })).optional(),
    tcpPort: z.coerce.number<string | number>().int().min(1).max(65535).optional(),
    periodSeconds: z.coerce.number<string | number>().int().min(1).default(15),
    timeoutSeconds: z.coerce.number<string | number>().int().min(1).default(5),
    failureThreshold: z.coerce.number<string | number>().int().min(1).default(3),
});

export type HealthCheckModel = z.infer<typeof healthCheckZodModel>;

export type HealthCheckWorkload = {
    id: string;
    healthChechHttpGetPath?: string | null;
    healthCheckHttpScheme?: string | null;
    healthCheckHttpHeadersJson?: string | null;
    healthCheckHttpPort?: number | null;
    healthCheckPeriodSeconds: number;
    healthCheckTimeoutSeconds: number;
    healthCheckFailureThreshold: number;
    healthCheckTcpPort?: number | null;
};
