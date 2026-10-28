import { z } from "zod";

export class ValueFormatUtils {
    static firstLiteLlmTeamId(teams: unknown[] | undefined): string | undefined {
        const firstTeam = teams?.[0];
        const parsedTeam = z.record(z.string(), z.unknown()).safeParse(firstTeam);
        const team = typeof firstTeam === 'string'
            ? { team_id: firstTeam }
            : parsedTeam.success ? parsedTeam.data : undefined;

        return this.firstValidValue(
            [team],
            ['team_id', 'id'],
            z.string().trim().min(1),
        );
    }

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
