import { z } from 'zod';

export const mcpServerModeZodModel = z.enum(['off', 'readonly', 'readwrite']);

export type McpServerMode = z.infer<typeof mcpServerModeZodModel>;

export const MCP_SERVER_MODE_LABELS: Record<McpServerMode, string> = {
    off: 'Off',
    readonly: 'Read only',
    readwrite: 'Read & write',
};
