type JsonSchema = Record<string, unknown>;

/**
 * Removes every response field whose schema carries `.meta({ secret: true })`.
 *
 * The MCP operation registry exposes each REST response as JSON Schema, so the
 * redaction follows the exact response shape, including arrays, unions and
 * nullable wrappers. It is intentionally conservative: when multiple union
 * variants match, all matching variants are applied.
 */
export class McpSecretRedactionUtils {

    redact(value: unknown, schema: JsonSchema | undefined): unknown {
        if (!schema) {
            return value;
        }
        return McpSecretRedactionUtils.redactValue(value, schema, schema);
    }

    private static redactValue(value: unknown, schema: JsonSchema | undefined, root: JsonSchema): unknown {
        if (!schema || typeof schema !== 'object') {
            return value;
        }
        if (schema.secret === true) {
            return undefined;
        }

        const resolved = this.resolve(schema, root);
        if (!resolved) {
            return value;
        }
        if (resolved.secret === true) {
            return undefined;
        }

        let workingValue = value;
        if (Array.isArray(resolved.allOf)) {
            for (const part of resolved.allOf) {
                workingValue = this.redactValue(workingValue, part as JsonSchema, root);
            }
        }

        const branches = this.unionBranches(resolved);
        if (branches.length > 0) {
            const matching = branches.filter((branch) => this.matches(workingValue, branch, root));
            const selected = matching.length > 0 ? matching : [branches[0] as JsonSchema];

            for (const branch of selected) {
                workingValue = this.redactValue(workingValue, branch, root);
            }
        }

        if (Array.isArray(workingValue)) {
            const items = resolved.items;
            if (!items) {
                return workingValue;
            }
            if (Array.isArray(items)) {
                return workingValue.map((item, index) => this.redactValue(item, items[index] as JsonSchema | undefined, root));
            }
            return workingValue.map((item) => this.redactValue(item, items as JsonSchema, root));
        }

        if (workingValue !== null && typeof workingValue === 'object') {
            const properties = this.properties(resolved);
            const result = { ...(workingValue as Record<string, unknown>) };
            const knownKeys = new Set(Object.keys(properties));

            for (const [key, propertySchema] of Object.entries(properties)) {
                if (!(key in result)) {
                    continue;
                }
                if (propertySchema.secret === true) {
                    delete result[key];
                    continue;
                }

                const redacted = this.redactValue(result[key], propertySchema, root);
                if (redacted === undefined) {
                    delete result[key];
                } else {
                    result[key] = redacted;
                }
            }

            const additionalProperties = resolved.additionalProperties;
            if (additionalProperties && typeof additionalProperties === 'object' && !Array.isArray(additionalProperties)) {
                for (const key of Object.keys(result)) {
                    if (!knownKeys.has(key)) {
                        result[key] = this.redactValue(result[key], additionalProperties as JsonSchema, root);
                    }
                }
            }

            return result;
        }

        return workingValue;
    }

    private static resolve(schema: JsonSchema, root: JsonSchema): JsonSchema | undefined {
        let current: JsonSchema | undefined = schema;
        const seen = new Set<string>();

        while (current && typeof current.$ref === 'string') {
            if (seen.has(current.$ref)) {
                return current;
            }
            seen.add(current.$ref);

            const target = this.resolveRef(current.$ref, root);
            if (!target) {
                return current;
            }
            current = target;
        }

        return current;
    }

    private static resolveRef(ref: string, root: JsonSchema): JsonSchema | undefined {
        if (!ref.startsWith('#/')) {
            return undefined;
        }

        let current: unknown = root;
        for (const rawSegment of ref.slice(2).split('/')) {
            const segment = rawSegment.replace(/~1/g, '/').replace(/~0/g, '~');
            if (!current || typeof current !== 'object') {
                return undefined;
            }
            current = (current as Record<string, unknown>)[segment];
        }

        return current && typeof current === 'object' && !Array.isArray(current)
            ? current as JsonSchema
            : undefined;
    }

    private static unionBranches(schema: JsonSchema): JsonSchema[] {
        for (const key of ['anyOf', 'oneOf']) {
            const branches = schema[key];
            if (Array.isArray(branches)) {
                return branches.filter((branch): branch is JsonSchema =>
                    Boolean(branch) && typeof branch === 'object' && !Array.isArray(branch)
                );
            }
        }
        return [];
    }

    private static matches(value: unknown, schema: JsonSchema, root: JsonSchema): boolean {
        const resolved = this.resolve(schema, root);
        if (!resolved) {
            return true;
        }
        if ('const' in resolved) {
            return resolved.const === value;
        }
        if (Array.isArray(resolved.enum)) {
            return resolved.enum.includes(value);
        }

        const nestedBranches = this.unionBranches(resolved);
        if (nestedBranches.length > 0) {
            return nestedBranches.some((branch) => this.matches(value, branch, root));
        }

        const type = resolved.type;
        const types = Array.isArray(type) ? type : [type];

        return types.some((candidate) => {
            switch (candidate) {
                case 'null':
                    return value === null;
                case 'array':
                    return Array.isArray(value);
                case 'object':
                    return value !== null && typeof value === 'object' && !Array.isArray(value);
                case 'string':
                    return typeof value === 'string';
                case 'number':
                    return typeof value === 'number';
                case 'integer':
                    return typeof value === 'number' && Number.isInteger(value);
                case 'boolean':
                    return typeof value === 'boolean';
                default:
                    return true;
            }
        });
    }

    private static properties(schema: JsonSchema): Record<string, JsonSchema> {
        const properties = schema.properties;
        if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
            return {};
        }
        return properties as Record<string, JsonSchema>;
    }
}

const mcpSecretRedactionUtils = new McpSecretRedactionUtils();
export default mcpSecretRedactionUtils;
