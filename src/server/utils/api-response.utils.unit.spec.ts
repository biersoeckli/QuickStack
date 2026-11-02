import { Elysia } from "elysia";
import { z } from "zod";
import { ApiUtils } from "./api-response.utils";

describe("api-response.utils", () => {
    describe("mapReponseModel", () => {
        it("maps nested date response fields to schemas that accept serialized strings", () => {
            const responseSchema = ApiUtils.mapResponseModel(z.object({
                createdAt: z.date(),
                nested: z.object({
                    updatedAt: z.date().nullable().optional(),
                }),
                items: z.array(z.object({
                    startedAt: z.date(),
                })),
            }));

            const parsed = responseSchema[200].parse({
                createdAt: "2024-01-01T00:00:00.000Z",
                nested: {
                    updatedAt: "2024-01-02T00:00:00.000Z",
                },
                items: [{
                    startedAt: "2024-01-03T00:00:00.000Z",
                }],
            }) as {
                createdAt: Date;
                nested: { updatedAt?: Date | null };
                items: Array<{ startedAt: Date }>;
            };

            expect(parsed.createdAt).toBeInstanceOf(Date);
            expect(parsed.nested.updatedAt).toBeInstanceOf(Date);
            expect(parsed.items[0].startedAt).toBeInstanceOf(Date);
        });

        it("keeps nullable and optional date fields valid", () => {
            const responseSchema = ApiUtils.mapResponseModel(z.object({
                deletedAt: z.date().nullable().optional(),
            }));

            expect(responseSchema[200].parse({ deletedAt: null })).toEqual({ deletedAt: null });
            expect(responseSchema[200].parse({})).toEqual({});
        });

        it("preserves secret metadata on nullable and optional fields", () => {
            const responseSchema = ApiUtils.mapResponseModel(z.object({
                envVars: z.string().meta({ secret: true }),
                registryPassword: z.string().nullish().meta({ secret: true }),
            }));
            const jsonSchema = z.toJSONSchema(responseSchema[200]) as {
                properties: Record<string, { secret?: boolean }>;
            };

            expect(jsonSchema.properties.envVars.secret).toBe(true);
            expect(jsonSchema.properties.registryPassword.secret).toBe(true);
        });
    });

    describe("mapError", () => {
        it("exposes Elysia request validation issues as field errors", async () => {
            const app = new Elysia()
                .onError(({ error }) => ApiUtils.mapError(error))
                .post("/apps", ({ body }) => body, {
                    body: z.object({
                        name: z.string().min(3),
                        domains: z.array(z.object({ hostname: z.string().min(3) })),
                    }),
                });

            const response = await app.handle(new Request("http://localhost/apps", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ name: "x", domains: [{ hostname: "y" }] }),
            }));
            const problem = await response.json() as {
                status: number;
                detail: string;
                errors: Array<{ path: string; message: string }>;
            };

            expect(response.status).toBe(422);
            expect(problem.errors).toHaveLength(2);
            expect(problem.errors.map((entry) => entry.path)).toEqual(["name", "domains.0.hostname"]);
            expect(problem.detail).toContain("name - ");
            expect(problem.detail).toContain("domains.0.hostname - ");
        });

        it("exposes Zod issues as field errors", async () => {
            const problem = await ApiUtils.mapError(new z.ZodError([
                { code: "too_small", minimum: 3, origin: "string", path: ["name"], message: "Too small" },
            ])).json() as {
                status: number;
                errors: Array<{ path: string; message: string }>;
            };

            expect(problem.status).toBe(400);
            expect(problem.errors).toEqual([{ path: "name", message: "Too small" }]);
        });
    });
});
