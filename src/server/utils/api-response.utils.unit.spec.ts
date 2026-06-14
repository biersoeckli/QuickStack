import { z } from "zod";
import { ApiUtils } from "./api-response.utils";

describe("api-response.utils", () => {
    describe("mapReponseModel", () => {
        it("maps nested date response fields to schemas that accept serialized strings", () => {
            const responseSchema = ApiUtils.mapReponseModel(z.object({
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
            const responseSchema = ApiUtils.mapReponseModel(z.object({
                deletedAt: z.date().nullable().optional(),
            }));

            expect(responseSchema[200].parse({ deletedAt: null })).toEqual({ deletedAt: null });
            expect(responseSchema[200].parse({})).toEqual({});
        });
    });
});
