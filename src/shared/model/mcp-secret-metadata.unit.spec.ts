import { z } from 'zod';
import { AppExtendedZodModel } from './app-extended.model';
import { AgentExtendedZodModel } from './agent-extended.model';
import { agentSandboxAccessUrlZodModel, agentSandboxApiTokenZodModel } from './agent-sandbox.model';

type JsonSchema = Record<string, unknown>;

function resolve(schema: JsonSchema, root: JsonSchema): JsonSchema {
    const ref = schema.$ref;
    if (typeof ref !== 'string' || !ref.startsWith('#/')) {
        return schema;
    }

    let current: unknown = root;
    for (const segment of ref.slice(2).split('/')) {
        if (!current || typeof current !== 'object') {
            return schema;
        }
        current = (current as Record<string, unknown>)[segment.replace(/~1/g, '/').replace(/~0/g, '~')];
    }
    return current && typeof current === 'object' && !Array.isArray(current) ? current as JsonSchema : schema;
}

function secretPaths(schema: JsonSchema, root: JsonSchema = schema, path = ''): string[] {
    const resolved = resolve(schema, root);
    const paths: string[] = [];

    if (resolved.secret === true) {
        paths.push(path || '(root)');
    }

    const properties = resolved.properties;
    if (properties && typeof properties === 'object' && !Array.isArray(properties)) {
        for (const [key, property] of Object.entries(properties)) {
            paths.push(...secretPaths(property as JsonSchema, root, path ? `${path}.${key}` : key));
        }
    }

    const items = resolved.items;
    if (items && typeof items === 'object' && !Array.isArray(items)) {
        paths.push(...secretPaths(items as JsonSchema, root, `${path}[]`));
    }

    for (const key of ['anyOf', 'oneOf', 'allOf']) {
        const branches = resolved[key];
        if (Array.isArray(branches)) {
            for (const branch of branches) {
                paths.push(...secretPaths(branch as JsonSchema, root, path));
            }
        }
    }

    return paths;
}

describe('MCP secret metadata', () => {
    it('marks App response secrets', () => {
        const paths = secretPaths(z.toJSONSchema(AppExtendedZodModel, { unrepresentable: 'any' }) as JsonSchema);

        expect(paths).toEqual(expect.arrayContaining([
            'envVars',
            'buildArgs',
            'containerRegistryPassword',
            'gitToken',
            'appBasicAuths[].password',
            'webhookId',
            'healthCheckHttpHeadersJson',
        ]));
    });

    it('marks Agent response secrets', () => {
        const paths = secretPaths(z.toJSONSchema(AgentExtendedZodModel, { unrepresentable: 'any' }) as JsonSchema);

        expect(paths).toEqual(expect.arrayContaining([
            'encryptedEnvVars',
            'containerRegistryPassword',
            'gitToken',
            'agentGitSshKey.encryptedPrivateKey',
            'llmGateway.encryptedAdminKey',
            'healthCheckHttpHeadersJson',
        ]));
    });

    it('marks temporary sandbox access tokens', () => {
        const accessUrlPaths = secretPaths(z.toJSONSchema(agentSandboxAccessUrlZodModel) as JsonSchema);
        const apiTokenPaths = secretPaths(z.toJSONSchema(agentSandboxApiTokenZodModel) as JsonSchema);

        expect(accessUrlPaths).toContain('url');
        expect(apiTokenPaths).toContain('token');
    });
});
