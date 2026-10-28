import { z } from "zod";

export class ValueFormatUtils {
    static firstValidValue<T>(
        sources: Array<Record<string, unknown> | undefined>,
        keys: string[],
        schema: z.ZodType<T>,
    ): T | undefined {
        for (const source of sources) {
            for (const key of keys) {
                const result = schema.safeParse(source?.[key]);
                if (result.success) {
                    return result.data;
                }
            }
        }

        return undefined;
    }
}
