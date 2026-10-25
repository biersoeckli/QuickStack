import mcpSecretRedactionUtils from './mcp-secret-redaction';

type JsonSchema = Record<string, unknown>;

describe('McpSecretRedactionUtils', () => {
    it('redacts nested secrets through arrays and local refs', () => {
        const schema: JsonSchema = {
            type: 'object',
            properties: {
                apps: {
                    type: 'array',
                    items: { $ref: '#/$defs/App' },
                },
                visible: { type: 'string' },
            },
            $defs: {
                App: {
                    type: 'object',
                    properties: {
                        name: { type: 'string' },
                        envVars: { type: 'string', secret: true },
                        nested: {
                            type: 'object',
                            properties: {
                                token: { type: 'string', secret: true },
                                visible: { type: 'string' },
                            },
                        },
                    },
                },
            },
        };

        const result = mcpSecretRedactionUtils.redact({
            apps: [{
                name: 'demo',
                envVars: 'API_KEY=secret',
                nested: { token: 'nested-secret', visible: 'ok' },
            }],
            visible: 'root',
        }, schema);

        expect(result).toEqual({
            apps: [{
                name: 'demo',
                nested: { visible: 'ok' },
            }],
            visible: 'root',
        });
    });

    it('redacts secrets in union and allOf schemas', () => {
        const schema: JsonSchema = {
            anyOf: [
                {
                    type: 'object',
                    properties: {
                        items: { type: 'array', items: { type: 'string' } },
                    },
                },
                {
                    type: 'object',
                    properties: {
                        items: { type: 'array', items: { type: 'string' } },
                        total: { type: 'number' },
                    },
                },
            ],
            allOf: [
                {
                    type: 'object',
                    properties: {
                        gitToken: { type: 'string', secret: true },
                    },
                },
            ],
        };

        const result = mcpSecretRedactionUtils.redact({
            items: ['a'],
            total: 1,
            gitToken: 'secret',
        }, schema);

        expect(result).toEqual({ items: ['a'], total: 1 });
    });

    it('redacts secrets declared inside a union branch', () => {
        const result = mcpSecretRedactionUtils.redact({
            gitToken: 'secret',
            visible: 'ok',
        }, {
            type: 'object',
            properties: {
                gitToken: {
                    anyOf: [
                        { type: 'string', secret: true },
                        { type: 'null' },
                    ],
                },
                visible: { type: 'string' },
            },
        });

        expect(result).toEqual({ visible: 'ok' });
    });

    it('keeps visible fields when no secret metadata exists', () => {
        const result = mcpSecretRedactionUtils.redact({
            name: 'demo',
            envVars: 'API_KEY=secret',
        }, {
            type: 'object',
            properties: {
                name: { type: 'string' },
                envVars: { type: 'string' },
            },
        });

        expect(result).toEqual({ name: 'demo', envVars: 'API_KEY=secret' });
    });
});
