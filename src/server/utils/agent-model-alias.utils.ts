export class AgentModelAliasUtils {
    static normalize(modelAlias: unknown): string[] {
        if (Array.isArray(modelAlias)) {
            return modelAlias.flatMap((item) => AgentModelAliasUtils.normalize(item));
        }

        if (typeof modelAlias === 'string' && modelAlias.trim().length > 0) {
            try {
                const parsed = JSON.parse(modelAlias);
                if (Array.isArray(parsed)) {
                    return AgentModelAliasUtils.normalize(parsed);
                }
            } catch {
                // Backward compatibility for pre-array single alias values.
            }
            return [modelAlias];
        }

        return [];
    }
}
