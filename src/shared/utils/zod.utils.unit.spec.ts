import { z } from "zod";
import { ZodUtils, stringToNumber, stringToOptionalNumber, stringToOptionalDate, stringToDate, stringToOptionalBoolean, stringToBoolean } from "@/shared/utils/zod.utils";

describe("ZodUtils", () => {
    describe("getFieldNamesAndTypes", () => {
        it("should return field names and types from schema", () => {
            const schema = z.object({
                name: z.string(),
                age: z.number(),
                isActive: z.boolean(),
            });

            const result = ZodUtils.getFieldNamesAndTypes(schema);

            expect(result.get("name")).toBe("ZodString");
            expect(result.get("age")).toBe("ZodNumber");
            expect(result.get("isActive")).toBe("ZodBoolean");
        });
    });
});

describe("stringToNumber", () => {
    it("should transform string to number", () => {
        expect(stringToNumber.parse("123")).toBe(123);
    });

    it("should return null for invalid number string", () => {
        expect(stringToNumber.safeParse("abc").success).toBe(false);
    });

    it("should return number as is", () => {
        expect(stringToNumber.parse(123)).toBe(123);
    });
});

describe("stringToOptionalNumber", () => {
    it("should transform string to number", () => {
        expect(stringToOptionalNumber.parse("123")).toBe(123);
    });

    it("should return null for invalid number string", () => {
        expect(stringToOptionalNumber.parse("abc")).toBeNull();
    });

    it("should return number as is", () => {
        expect(stringToOptionalNumber.parse(123)).toBe(123);
    });

    it("should return null for null or undefined", () => {
        expect(stringToOptionalNumber.parse(null)).toBeNull();
        expect(stringToOptionalNumber.parse(undefined)).toBeNull();
    });
});

describe("stringToOptionalDate", () => {
    it("should transform string to date", () => {
        const date = new Date("2023-01-01");
        expect(stringToOptionalDate.parse("2023-01-01")).toEqual(date);
    });

    it("should return null for invalid date string", () => {
        expect(stringToOptionalDate.parse("invalid-date")).toBeNull();
    });

    it("should return date as is", () => {
        const date = new Date("2023-01-01");
        expect(stringToOptionalDate.parse(date)).toEqual(date);
    });

    it("should return null for null or undefined", () => {
        expect(stringToOptionalDate.parse(null)).toBeNull();
        expect(stringToOptionalDate.parse(undefined)).toBeNull();
    });
});

describe("stringToDate", () => {
    it("should transform string to date", () => {
        const date = new Date("2023-01-01");
        expect(stringToDate.parse("2023-01-01")).toEqual(date);
    });

    it("should return null for invalid date string", () => {
        expect(stringToDate.safeParse("invalid-date").success).toBe(false);
    });

    it("should return date as is", () => {
        const date = new Date("2023-01-01");
        expect(stringToDate.parse(date)).toEqual(date);
    });
});

describe("stringToOptionalBoolean", () => {
    it("should transform 'true' string to true", () => {
        expect(stringToOptionalBoolean.parse("true")).toBe(true);
    });

    it("should transform 'false' string to false", () => {
        expect(stringToOptionalBoolean.parse("false")).toBe(false);
    });

    it("should return null for invalid boolean string", () => {
        expect(stringToOptionalBoolean.parse("invalid")).toBeNull();
    });

    it("should return boolean as is", () => {
        expect(stringToOptionalBoolean.parse(true)).toBe(true);
        expect(stringToOptionalBoolean.parse(false)).toBe(false);
    });

    it("should return null for null or undefined", () => {
        expect(stringToOptionalBoolean.parse(null)).toBeNull();
        expect(stringToOptionalBoolean.parse(undefined)).toBeNull();
    });
});

describe("stringToBoolean", () => {
    it("should transform 'true' string to true", () => {
        expect(stringToBoolean.parse("true")).toBe(true);
    });

    it("should transform 'false' string to false", () => {
        expect(stringToBoolean.parse("false")).toBe(false);
    });

    it("should return false for invalid boolean string", () => {
        expect(stringToBoolean.parse("invalid")).toBe(false);
    });

    it("should return boolean as is", () => {
        expect(stringToBoolean.parse(true)).toBe(true);
        expect(stringToBoolean.parse(false)).toBe(false);
    });

    it("should return false for null or undefined", () => {
        expect(stringToBoolean.parse(null)).toBe(false);
        expect(stringToBoolean.parse(undefined)).toBe(false);
    });
});