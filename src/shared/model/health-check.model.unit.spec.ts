import { describe, expect, it } from "vitest";
import { healthCheckZodModel } from "./health-check.model";

const baseInput = {
    workloadId: "agent-id",
    enabled: true,
    probeType: "HTTP" as const,
    path: "/healthz",
    httpPort: 8080,
};

describe("healthCheckZodModel", () => {
    it("accepts HTTP and TCP health checks with default timings", () => {
        expect(healthCheckZodModel.parse(baseInput)).toMatchObject({
            ...baseInput,
            periodSeconds: 15,
            timeoutSeconds: 5,
            failureThreshold: 3,
        });
        expect(healthCheckZodModel.parse({
            workloadId: "agent-id",
            enabled: true,
            probeType: "TCP",
            tcpPort: 3000,
        }).tcpPort).toBe(3000);
    });

    it("rejects invalid ports and timing values", () => {
        expect(healthCheckZodModel.safeParse({ ...baseInput, httpPort: 0 }).success).toBe(false);
        expect(healthCheckZodModel.safeParse({ ...baseInput, periodSeconds: 0 }).success).toBe(false);
        expect(healthCheckZodModel.safeParse({ ...baseInput, timeoutSeconds: 0 }).success).toBe(false);
        expect(healthCheckZodModel.safeParse({ ...baseInput, failureThreshold: 0 }).success).toBe(false);
    });
});
